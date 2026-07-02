import child_process from 'child_process'
import ky from 'ky'
import util from 'util'

const execAsync = util.promisify(child_process.exec)

export const version = /v\d+\.\d+\.\d+/

export const exec = async ({ command, response, secrets }) => {
  try {
    let hidden = hide({ target: command, secrets })
    console.log('\x1b[33m%s\x1b[0m', hidden)
    typeof response === 'object' && response.write(`\x1b[33m${hidden}\x1b[0m\n`)
    const { stdout } = (await execAsync(command, { maxBuffer: 1024 * 1024 * 4 }))
    hidden = hide({ target: stdout, secrets })
    console.log(hidden)
    typeof response === 'object' && response.write(`${hidden}\n`)
    return stdout
  } catch (error) {
    throw hide({ target: error, secrets })
  }
}

export const EXEC = ({ response }) => {
  return async function ({ command, secrets }) {
    return exec({ command, response, secrets })
  }
}

export const getDomain = ({ domain }) => {
  const split = domain.split('.')
  return `${split[split.length - 2]}.${split[split.length - 1]}`
}

export const getCloudAPItoken = ({ cloud }) => {
  console.log(cloud)
  if (cloud === 'hetzner') {
    return process.env.HETZNER_API_TOKEN
  }
}

export const getLatestNode = ({ major }) => {
  return ky(`https://nodejs.org/download/release/latest-v${major}.x/SHASUMS256.txt`)
    .then(result => result.text())
    .then((body) => {
      return body.split(/\n/)
        .map(line => line.split(/\s+/))
        .filter((line) => {
          return typeof line[1] === 'string' && line[1].match(/linux-x64\.tar\.xz$/i)
        })
        .map(line => {
          return { checksum: line[0], file: line[1], path: line[1].match(/.*[^\.tar\.xz$]/)[0], version: line[1].match(version)[0] }
        })[0]
    })
}

function hide({ target, secrets }) {
  return target // TODO temporary debug line
  // Empty secrets array will hide everything.
  if (secrets === undefined) {
    return target
  }
  let result = target
  if (typeof target === 'object' && typeof target.message === 'string') {
    result = target.message
  }
  if (secrets.length > 0) {
    for (let i = 0; i < secrets.length; i++) {
      const secret = secrets[i]
      result = result.split(secret).join(Array(secret.length).join('*'))
    }
  } else {
    result = result.replace(/./g, '*')
  }
  if (typeof target === 'object' && typeof target.message === 'string') {
    target.message = result
    return target
  }

  return result
}

export async function install({ path, major, ssh, user }) {
  await ssh({ command: `adduser --disabled-password --gecos "" ubuntu`, user: 'root' })
  await ssh({ command: `usermod -aG sudo ubuntu`, user: 'root' })
  await ssh({ command: `echo 'ubuntu ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/ubuntu && chmod 440 /etc/sudoers.d/ubuntu`, user: 'root' })
  await ssh({ command: `mkdir -p /home/ubuntu/.ssh && chmod 700 /home/ubuntu/.ssh`, user: 'root' })
  await ssh({ command: `cp /root/.ssh/authorized_keys /home/ubuntu/.ssh/authorized_keys`, user: 'root' })
  await ssh({ command: `chown -R ubuntu:ubuntu /home/ubuntu/.ssh && chmod 600 /home/ubuntu/.ssh/authorized_keys`, user: 'root' })

  await ssh({ command: `sudo mkdir ${path}` })
  await ssh({ command: `sudo chown ${user} ${path}` })
  await ssh({ command: `echo 'LineMax=1M' | sudo tee -a /etc/systemd/journald.conf` })
  await ssh({ command: `echo '$MaxMessageSize 64k' | sudo tee -a /etc/rsyslog.conf` })

  await ssh({ command: 'sudo apt-get update' })
  await ssh({ command: 'sudo apt-get -y install restic' })
  await ssh({ command: 'sudo apt-get -y install nginx' })
  await ssh({ command: 'sudo apt-get -y install libnginx-mod-http-lua' })
  await ssh({ command: 'sudo apt-get -y install lua-nginx-cookie' })
  await ssh({ command: 'sudo rm /etc/nginx/sites-enabled/default' })
  await ssh({ command: 'sudo ln /usr/share/nginx/modules-available/mod-http-lua.conf /usr/share/nginx/modules-enabled' })

  const latestNode = await getLatestNode({ major })
  for (const command of installNode({ path, latestNode, major })) {
    await ssh({ command })
  }
  await ssh({ command: `sudo ln -f -s ${path}/opt/${latestNode.path}/bin/node /usr/bin/node` })
  await ssh({ command: `sudo ln -f -s ${path}/opt/${latestNode.path}/bin/npm /usr/bin/npm` })
  await ssh({ command: `sudo ln -f -s ${path}/opt/${latestNode.path}/bin/npx /usr/bin/npx` })

  await ssh({ command: 'sudo unattended-upgrade -d' })
}

export const installNode = ({ path, latestNode, major }) => {
  return [
    `cd ${path} && curl -L -O https://nodejs.org/download/release/latest-v${major}.x/${latestNode.file}`,
    `cd ${path} && echo "${latestNode.checksum} ${latestNode.file}" | sha256sum -c`,
    `mkdir ${path}/opt || true`,
    `tar -xf ${path}/${latestNode.file} -C ${path}/opt`,
  ]
}

export const instance = ({ instances, instance_name }) => {
  for (let i = 0; i < instances.length; i++) {
    if (instances[i].name === instance_name) {
      return instances[i]
    }
  }
}

export const service = ({ instances, service_name, tier }) => {
  for (let i = 0; i < instances.length; i++) {
    for (let j = 0; j < instances[i].services.length; j++) {
      if (instances[i].services[j].name === service_name && instances[i].services[j].tier === tier) {
        return {
          instance: instances[i],
          service: instances[i].services[j],
        }
      }
    }
  }
}

export async function retry(fn, { retries = 10, factor = 2, minTimeout = 1000, maxTimeout = Infinity, randomize = true } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt >= retries) throw error
      const random = randomize ? Math.random() + 1 : 1
      const timeout = Math.min(random * minTimeout * Math.pow(factor, attempt), maxTimeout)
      await new Promise((resolve) => setTimeout(resolve, timeout))
    }
  }
}

export const SSH = ({ address, keyName, instance, response }) => {
  return async function ({ command, secrets, user }) {
    user = user || process.env.ALIAJS_DEFAULT_USER
    try {
      let hidden = hide({ target: command, secrets })
      console.log('\x1b[33m%s\x1b[0m', `${address}`)
      console.log('\x1b[33m%s\x1b[0m', `${hidden}`)
      typeof response === 'object' && response.write(`\x1b[33m${hidden}\x1b[0m\n`)
      let stdout = (await execAsync(`ssh -T -q -i ~/.ssh/${keyName}.pem -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ${user}@${address} <<'qvKZVk5t1VB9B3UP2DmVNU'
echo '6DFqRyWxivCaZxp4MCWLgX'
${command}
qvKZVk5t1VB9B3UP2DmVNU`, { maxBuffer: 1024 * 1024 * 4 })).stdout
      stdout = stdout.slice(stdout.indexOf('6DFqRyWxivCaZxp4MCWLgX') + 23)
      hidden = hide({ target: stdout, secrets })
      typeof response === 'object' && response.write(`${hidden}\n`)
      console.log(hidden)
      return stdout
    } catch (error) {
      throw hide({ target: error, secrets })
    }
  }
}
