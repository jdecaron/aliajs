const child_process = require('child_process')
const util = require('util')

const exec = util.promisify(child_process.exec)

exports.version = /v\d+\.\d+\.\d+/

exports.exec = async ({ command, response, secrets }) => {
  try {
    let hidden = hide({ target: command, secrets })
    console.log('\x1b[33m%s\x1b[0m', hidden)
    typeof response === 'object' && response.write(`\x1b[33m${hidden}\x1b[0m\n`)
    const { stdout } = (await exec(command, { maxBuffer: 1024 * 1024 * 4 }))
    hidden = hide({ target: stdout, secrets })
    console.log(hidden)
    typeof response === 'object' && response.write(`${hidden}\n`)
    return stdout
  } catch (error) {
    throw hide({ target: error, secrets })
  }
}

exports.EXEC = ({ response }) => {
  return async function ({ command, secrets }) {
    return exports.exec({ command, response, secrets })
  }
}

exports.getDomain = ({ domain }) => {
  const split = domain.split('.')
  return `${split[split.length - 2]}.${split[split.length - 1]}`
}

exports.getLatestFilebeat = () => {
  // Elastic.co is the sole Filebeat publisher for now, they broke the Filebeat compatibility
  // with OpenSearch. For this reason, Filebeat is pinned to 7-12-1. See these two links
  // for more details about the breaking changes:
  // https://www.reddit.com/r/aws/comments/nn95aq/elastic_has_broken_filebeat_as_of_713_it_no/
  // https://github.com/elastic/beats/issues/25865

  // For the full OpenSearch compatibility matrix for Beats:
  // https://opensearch.org/docs/latest/clients/agents-and-ingestion-tools/index/#compatibility-matrix-for-beats


  // return fetch(`https://api.github.com/repos/elastic/beats/releases/latest`)
  //   .then(result => result.json())
  //   .then(result => result.tag_name.match(/\d+\.\d+\.\d+/)[0])

  return Promise.resolve('oss-7.12.1')
}

exports.getLatestNode = ({ major }) => {
  return fetch(`https://nodejs.org/download/release/latest-v${major}.x/SHASUMS256.txt`)
    .then(result => result.text())
    .then((body) => {
      return body.split(/\n/)
        .map(line => line.split(/\s+/))
        .filter((line) => {
          return typeof line[1] === 'string' && line[1].match(/linux-x64\.tar\.xz$/i)
        })
        .map(line => {
          return { checksum: line[0], file: line[1], path: line[1].match(/.*[^\.tar\.xz$]/)[0], version: line[1].match(exports.version)[0] }
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

exports.install = async function ({ path, major, ssh, user }) {
  await ssh({ command: `sudo mkdir ${path}` })
  await ssh({ command: `sudo chown ${user} ${path}` })
  await ssh({ command: `echo 'LineMax=1M' | sudo tee -a /etc/systemd/journald.conf` })
  await ssh({ command: `echo '$MaxMessageSize 64k' | sudo tee -a /etc/rsyslog.conf` })

  const latestFilebeat = await exports.getLatestFilebeat()
  await ssh({ command: `curl -L -O https://artifacts.elastic.co/downloads/beats/filebeat/filebeat-${latestFilebeat}-amd64.deb` })
  await ssh({ command: `sudo dpkg -i filebeat-${latestFilebeat}-amd64.deb` })

  await ssh({ command: 'sudo apt-get update' })
  await ssh({ command: 'sudo apt-get -y install nginx' })
  await ssh({ command: 'sudo apt-get -y install libnginx-mod-http-lua' })
  await ssh({ command: 'sudo apt-get -y install lua-nginx-cookie' })
  await ssh({ command: 'sudo rm /etc/nginx/sites-enabled/default' })
  await ssh({ command: 'sudo ln /usr/share/nginx/modules-available/mod-http-lua.conf /usr/share/nginx/modules-enabled' })
  await ssh({ command: 'sudo apt-get -y install prometheus-node-exporter' })

  const latestNode = await exports.getLatestNode({ major })
  for (const command of exports.installNode({ path, latestNode, major })) {
    await ssh({ command })
  }
  await ssh({ command: `sudo ln -f -s ${path}/opt/${latestNode.path}/bin/node /usr/bin/node` })
  await ssh({ command: `sudo ln -f -s ${path}/opt/${latestNode.path}/bin/npm /usr/bin/npm` })
  await ssh({ command: `sudo ln -f -s ${path}/opt/${latestNode.path}/bin/npx /usr/bin/npx` })

  await ssh({ command: 'curl -fsSL https://tailscale.com/install.sh | sh' })

  await ssh({ command: 'sudo unattended-upgrade -d' })
}

exports.installNode = ({ path, latestNode, major }) => {
  return [
    `cd ${path} && curl -L -O https://nodejs.org/download/release/latest-v${major}.x/${latestNode.file}`,
    `cd ${path} && echo "${latestNode.checksum} ${latestNode.file}" | sha256sum -c`,
    `mkdir ${path}/opt || true`,
    `tar -xf ${path}/${latestNode.file} -C ${path}/opt`,
  ]
}

exports.instance = ({ instances, instance_name }) => {
  for (let i = 0; i < instances.length; i++) {
    if (instances[i].name === instance_name) {
      return instances[i]
    }
  }
}

exports.service = ({ instances, service_name, tier }) => {
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

exports.SSH = ({ address, keyName, response }) => {
  return async function ({ command, secrets }) {
    try {
      let hidden = hide({ target: command, secrets })
      console.log('\x1b[33m%s\x1b[0m', `${hidden}`)
      typeof response === 'object' && response.write(`\x1b[33m${hidden}\x1b[0m\n`)
      let stdout = (await exec(`ssh -T -q -i ~/.ssh/${keyName}.pem -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ubuntu@${address} <<'qvKZVk5t1VB9B3UP2DmVNU'
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
