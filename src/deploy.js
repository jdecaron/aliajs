import './env.js'

import dns from 'dns'
import dotenv from 'dotenv'
import { Eta } from 'eta'
import fs from 'fs'
import https from 'https'
import path from 'path'
import util from 'util'
import { fileURLToPath } from 'url'
import * as items from './items.js'
import { retry } from './utils.js'
import logger from './logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const log = logger(__filename)

const lookup = util.promisify(dns.lookup)
const eta = new Eta({ views: path.join(__dirname, '..', 'templates'), useWith: true, autoTrim: false })

export async function nginx({ address, checkout, domain, exec, flags, initial, home, instance, service, ssh, user }) {
  const { domains, locations, remote_repository } = service

  const temp = (await exec({ command: 'mktemp -d' })).replace(/\s$/, '')
  const repository = `${temp}/repository`
  const staticBuilds = `${process.env.ALIAJS_DEFAULT_PATH}/static-builds-${service.tier}`
  const unique = `${service.name}-${Date.now()}`
  const uniqueBuilds = {}

  await exec({ command: `mkdir ${repository} ${temp}/sync` })
  if (fs.existsSync(`${staticBuilds}`) === false) {
    await exec({ command: `mkdir ${staticBuilds}` })
  }

  const builds = locations.filter((location) => {
    return typeof location.build === 'string'
  })

  if (builds.length > 0) {
    await exec({ command: `git clone ${remote_repository} ${repository}`})

    if (checkout === undefined || checkout === '') {
      checkout = process.env.ALIAJS_DEFAULT_CHECKOUT
      try {
        checkout = JSON.parse(await ssh.current({ command: `cat ${staticBuilds}/${service.name}-default.json` })).checkout
      } catch (error) {
        log.warn(`WARNING! could not parse build info from file, checkout value will be set to ${checkout} (it can be OK)`)
      }
    }

    builds[0].checkout = checkout
    if (typeof builds[0].split === 'object') {
      builds[0].split[0].checkout = checkout
    }

    for (let i = 0; i < builds.length; i++) {
      builds[i].alias = `${staticBuilds}/$ab/`
      if (builds[i].split === undefined) {
        builds[i].split = [{ checkout: builds[i].checkout, split: 100 }]
      }

      for (let j = 0; j < builds[i].split.length; j++) {
        const buildIndex = await execBuild({ build: builds[i].split[j], exec, repository, service, staticBuilds })
        builds[i].split[j].buildIndex = buildIndex
        if (i === 0) {
          uniqueBuilds['default'] = buildIndex
          fs.writeFileSync(`${staticBuilds}/${service.name}-default.json`, JSON.stringify(builds[0].split[0]))
        }
        uniqueBuilds[buildIndex] = buildIndex
      }
    }
  }

  if (domain === undefined) {
    domain = process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN
  }
  if (home === undefined) {
    home = process.env.ALIAJS_DEFAULT_PATH
  }
  if (user === undefined) {
    user = process.env.ALIAJS_DEFAULT_USER
  }

  const server_name = `${service.name}-${service.tier}.${domain}`

  if (address === undefined) {
    address = (await lookup(server_name)).address
  }

  await exec({ command: `mkdir ${temp}/sync/sites-enabled` })
  let template = 'server'
  if (service.template) {
    template = service.template
  }
  for (let domain of domains) {
    const config = await eta.renderAsync(`nginx/${template}`, { locations, home, server_name: domain, uniqueBuilds })
    fs.writeFileSync(`${temp}/sync/sites-enabled/${domain}`, config)
  }

  const custom = await eta.renderAsync('nginx/custom', {})
  fs.writeFileSync(`${temp}/sync/custom.conf`, custom)

  await exec({ command: `rsync -az ${temp}/sync/ ${user}@${address}:${home}/${unique}` })
  await exec({ command: `rsync -az ${staticBuilds} ${user}@${address}:${home}` })
  await ssh.new({ command: `sudo mv -f ${home}/${unique}/custom.conf /etc/nginx/conf.d/` })
  await ssh.new({ command: `sudo cp -f ${home}/${unique}/sites-enabled/* /etc/nginx/sites-enabled/` })

  if (initial) {
    await operations({ data: { address, aliajs_key_name: process.env.ALIAJS_KEY_NAME, home, instance, server_name, temp, unique }, exec, flags, items, service, ssh, type: 'initial' })
    await operations({ data: { address, aliajs_key_name: process.env.ALIAJS_KEY_NAME, home, instance, server_name, temp, unique }, exec, flags, items, service, ssh, type: 'backup' })
    await operations({ data: { address, aliajs_key_name: process.env.ALIAJS_KEY_NAME, home, instance, server_name, temp, unique }, exec, flags, items, service, ssh, type: 'restore' })
  }

  await ssh.new({ command: 'sudo nginx -t' })
  await ssh.new({ command: 'sudo service nginx reload' })
}

export async function nodejs({ address, checkout, domain, exec, home, initial, instance, service, ssh, user, websocket }) {
  if (checkout === undefined || checkout === '') {
    checkout = process.env.ALIAJS_DEFAULT_CHECKOUT
    try {
      const directory = (await ssh.current({ command: `ls -t | grep ^${service.name} | head -n 1` })).replace(/\s$/, '')
      const status = await ssh.current({ command: `cd ${directory} && git status` })
      checkout = status.split('\n')[0].split(' ').pop()
    } catch (error) {
      log.warn(`WARNING! ${service.name} on current instance is not set, checkout value will be set to ${checkout} (it can be OK)`)
    }
  }
  if (domain === undefined) {
    domain = process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN
  }
  if (home === undefined) {
    home = process.env.ALIAJS_DEFAULT_PATH
  }
  if (user === undefined) {
    user = process.env.ALIAJS_DEFAULT_USER
  }

  const server_name = `${service.name}-${service.tier}.${domain}`
  const temp = (await exec({ command: 'mktemp -d' })).replace(/\s$/, '')
  const unique_service_name = `${service.name}-${new Date().getTime()}`

  if (address === undefined) {
    address = (await lookup(server_name)).address
  }

  let services = await ssh.new({ command: 'ls -t /etc/systemd/system' })
  services = services.split('\n').filter((folder) => {
    return folder.match(new RegExp(`^${service.name}`))
  }).reverse()

  await exec({ command: `git clone ${service.remote_repository} ${temp}`})
  await exec({ command: `cd ${temp} && git checkout ${checkout}` })
  await exec({ command: `cd ${temp} && ${command({ service, type: 'packages' })}` })
  await exec({ command: `cd ${temp} && ${command({ service, type: 'build' })}` })

  let port
  await retry(async () => {
    port = Math.floor(Math.random() * (65536 - 1024) + 1024)
    let used
    try {
      await exec({ command: `nc -z 127.0.0.1 ${port}` })
      used = true
    } catch(error) {
      // An error means the port is free.
      console.log(`Port ${port} is free`)
    }
    if (used === true) {
      throw new Error(`Port ${port} is already in used`)
    }
  })

  let variables = ''
  try {
    const variablesTemplate = fs.readFileSync(`${__dirname}/../configurations/systemd/variables/${service.name}/${service.tier}.eta`, 'utf8')
    variables = await eta.renderStringAsync(variablesTemplate, { main: command({ service, type: 'main' }), run: command({ service, type: 'run' }), service_name: service.name, tier: service.tier, unique_service_name, user, home, domain, port, variables })
  } catch (error) {
    log.warn(`WARNING! this service has no variable file for tier ${service.tier} (it can be OK)`)
  }

  const env = dotenv.parse(fs.readFileSync(`${temp}/.env`))
  items.development = getItems({ variables: items.operations.variables[0] })
  for (let name in env) {
    if (env[name] === '') {
      variables = `${variables}\nEnvironment=${name}=${getNotes({ items: items.development, name, systemdEscape: true })}`
    }
  }

  const system = await eta.renderAsync('systemd/service', { main: command({ service, type: 'main' }), run: command({ service, type: 'run' }), service_name: service.name, tier: service.tier, unique_service_name, user, home, domain, port, variables })
  fs.writeFileSync(`${temp}/service`, system)

  const locations = [{ location: '/', proxy_pass: `http://127.0.0.1:${port}` }]
  if (service.name === 'aliajs') {
    locations[0].proxy_read_timeout = '500s'
    fs.appendFileSync(`${temp}/.env`, `\nALIAJS_VARIABLE_0=${process.env.ALIAJS_VARIABLE_0}\nALIAJS_VARIABLE_1=${process.env.ALIAJS_VARIABLE_1}\nALIAJS_VARIABLE_2=${process.env.ALIAJS_VARIABLE_2}`)
  }

  const domains = service.domains || [server_name]
  await exec({ command: `mkdir ${temp}/sites-enabled` })
  for (let domain of domains) {
    const config = await eta.renderAsync('nginx/server', { locations, server_name: domain })
    fs.writeFileSync(`${temp}/nginx`, config)
    fs.writeFileSync(`${temp}/sites-enabled/${domain}`, config)
  }

  const custom = await eta.renderAsync('nginx/custom', {})
  fs.writeFileSync(`${temp}/custom`, custom)

  await exec({ command: `rsync -az ${temp}/ ${user}@${address}:${home}/${unique_service_name}` })
  await ssh.new({ command: `sudo cp -f ${home}/${unique_service_name}/sites-enabled/* /etc/nginx/sites-enabled/` })
  await ssh.new({ command: `sudo mv -f ${home}/${unique_service_name}/custom /etc/nginx/conf.d/custom.conf` })
  await ssh.new({ command: `sudo mv ${home}/${unique_service_name}/service /etc/systemd/system/${unique_service_name}.service` })

  if (initial) {
    await ssh.new({ command: `echo '127.0.0.1 ${server_name}' | sudo tee -a /etc/hosts` })
    await operations({ data: { address, aliajs_key_name: process.env.ALIAJS_KEY_NAME, home, instance, server_name, temp, unique_service_name }, exec, items, service, ssh, type: 'initial' })
    await operations({ data: { address, aliajs_key_name: process.env.ALIAJS_KEY_NAME, home, instance, server_name, temp, unique_service_name }, exec, items, service, ssh, type: 'backup' })
    await operations({ data: { address, aliajs_key_name: process.env.ALIAJS_KEY_NAME, home, instance, server_name, temp, unique_service_name }, exec, items, service, ssh, type: 'restore' })
  }
  await operations({ data: { instance, unique_service_name }, exec, items, service, ssh, type: 'post-build' })

  await ssh.new({ command: `sudo service ${unique_service_name} start` })
  await ssh.new({ command: `sudo systemctl enable ${unique_service_name}` })

  await retry(async () => {
    const response = await ssh.new({ command: `curl -i http://127.0.0.1:${port}/404-uc3C6` })
    if (response.match(/^(\S+)\s404/) === null) {
      throw new Error(`Service ${service.name} not responding 404 status`)
    }
  })

  await ssh.new({ command: 'sudo nginx -t' })
  await ssh.new({ command: 'sudo service nginx reload' })

  await retry(async () => {
    const response = await new Promise((resolve, reject) => {
      const req = https.request({
        host: address,
        port: 443,
        path: '/404-uc3C6',
        method: 'GET',
        headers: { Host: server_name },
        servername: server_name,
      }, resolve)
      req.on('error', reject)
      req.end()
    })
    response.resume()
    if (response.statusCode !== 404) {
      throw new Error(`Service ${service.name} not responding 404 status`)
    }
  })

  if (service.name === 'aliajs') {
    await ssh.new({ command: `echo \"0 5 * * 0 cd ${home}/${unique_service_name} && /usr/bin/node ${home}/${unique_service_name}/src/renew-certificates.js > renew-certificates.log 2>&1\n0 6 * * * cd ${home}/${unique_service_name} && /usr/bin/node ${home}/${unique_service_name}/src/new-image.js > new-image.log 2>&1\n30 8 * * * cd ${home}/${unique_service_name} && /usr/bin/node ${home}/${unique_service_name}/src/refresh-instances.js > refresh-instances.log 2>&1\" >> aliajs_cron; crontab aliajs_cron; rm aliajs_cron` })
  }

  for (let i = 0; i < services.length; i++) {
    const service = services[i].replace(/\.service$/, '')
    await ssh.new({ command: `sudo service ${service} stop` })
    await ssh.new({ command: `sudo systemctl disable ${service}` })
  }

  await exec({ command: `rm -rf ${temp}` })
}

function command({ data, service, type }) {
  const defaults = {
    javascript: {
      build: "echo 'nothing to build'",
      main: '/src/main',
      packages: 'npm install',
      run: '/usr/bin/node',
    },
    typescript: {
      build: 'npm run build',
      main: '/dist/main',
      packages: 'npm --production=false install',
      run: '/usr/bin/node',
    },
  }

  if (typeof service.operations === 'object' && typeof service.operations[type] === 'string') {
    return eta.renderString(service.operations[type], data)
  } else {
    return eta.renderString(defaults[service.language][type], data)
  }
}

async function execBuild({ build, exec, repository, service, staticBuilds }) {
  await exec({ command: `cd ${repository} && git checkout --force ${build.checkout}` })
  const buildIndex = (await exec({ command: `cd ${repository} && git rev-parse --verify HEAD` })).replace(/\s$/, '')
  if (fs.existsSync(`${staticBuilds}/${buildIndex}`) === false) {
    await exec({ command: `cd ${repository} && npm --production=false install` })
    await exec({ command: `cd ${repository} && npm run build` })
    fs.writeFileSync(`${repository}/dist/build.json`, JSON.stringify(build))
    await exec({ command: `mv ${repository}/dist ${staticBuilds}/${buildIndex}` })
    await exec({ command: `rm -rf ${repository}/node_modules ${repository}/package-lock.json` })
  } else {
    log.warn(`WARNING! ${staticBuilds}/${buildIndex} already exists, skipping this build (it can be OK)`)
  }
  return buildIndex
}

async function operations({ data, exec, flags, items, service, ssh, type }) {
  const targets = {
    current: ssh.current,
    new: ssh.new,
    orchestrator: exec
  }

  let skip = false
  if (flags?.exclude.length > 0 && flags.exclude.indexOf(type) > -1) {
    skip = true
  } else if (flags?.target.length > 0 && flags.target.indexOf(type) === -1) {
    skip = true
  }

  if (
    skip === false &&
    typeof service.operations === 'object' &&
    typeof service.operations[type] === 'object'
  ) {
    for (let i = 0; i < service.operations[type].length; i++) {
      if (typeof service.operations[type][i].command === 'function') {
        await service.operations[type][i].command({ c: { data, exec, items, service, ssh, type } })
      } else {
        const command = eta.renderString(service.operations[type][i].command, data)
        await targets[service.operations[type][i].target]({ command })
      }
    }
  } else {
    log.warn(`WARNING! Skipping operations of type ${type} (it can be OK)`)
  }
}
