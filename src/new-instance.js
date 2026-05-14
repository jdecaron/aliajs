require('dotenv').config()

const log = require('./logger')(__filename)

const ejs = require('ejs')
const fs = require('fs')
const util = require('util')
const cloud = require('./cloud/cloud.js')
const deploy = require('./deploy')
const { getNotes, items } = require('./items')
const { getDomain, exec, SSH } = require('./utils')
const configurations = require('../configurations/instances')

const renderFile = util.promisify(ejs.renderFile)

const installSSLCertificates = async ({ service, ssh }) => {
  const domains = service.domains || [`${service.name}-${service.tier}.${process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN}`]
  for (const domain of domains) {
    const name = getDomain({ domain })
    const fullchain = getNotes({ items: items.certificates, name: `${name}/fullchain.pem` })
    const privkey = getNotes({ items: items.certificates, name: `${name}/privkey.pem` })
    await ssh({ command: `sudo echo '${fullchain}' > fullchain.pem`, secrets: [] })
    await ssh({ command: `sudo mv fullchain.pem /etc/ssl/certs/${domain}.pem` })
    await ssh({ command: `sudo chmod 622 /etc/ssl/certs/${domain}.pem` })
    await ssh({ command: `sudo echo '${privkey}' > privkey.pem`, secrets: [] })
    await ssh({ command: `sudo mv privkey.pem /etc/ssl/private/${domain}.pem` })
    await ssh({ command: `sudo chmod 600 /etc/ssl/private/${domain}.pem` })
  }
}

exports.initInstance = async ({ address, instance, refresh, replace, response, temp }) => {
  const { imageName, name, services, type } = instance

  const keyName = instance.keyName || process.env.ALIAJS_KEY_NAME
  const { Reservations } = await cloud.newInstance({ address, imageName, keyName, instance, name: `${name}-${Math.random().toString(36).slice(2, 8)}`, type })
  instance.InstanceId = Reservations[0].Instances[0].InstanceId
  instance.privateIpAddress = Reservations[0].Instances[0].PrivateIpAddress

  const ssh = {
    current: SSH({ address: instance.address, keyName, instance, response }),
    new: SSH({ address: Reservations[0].Instances[0].PublicIpAddress, keyName, instance: Reservations[0].Instances[0], response }),
  }

  for (let item of items.operations) {
    const name = item.name
    if (name.match(/^authorized_keys/)) {
      await ssh.new({ command: `echo '${getNotes({ items: items.operations, name })}' >> ~/.ssh/authorized_keys`})
    }
  }

  for (const service of services) {
    await installSSLCertificates({ service, ssh: ssh.new })

    await deploy[service.type]({
      address: Reservations[0].Instances[0].PublicIpAddress,
      exec,
      initial: true,
      instance,
      service,
      ssh,
    })
  }

    if (replace === true) {
      if (typeof instance.address === 'string') {
        await cloud.associateAddress({ instance, ssh })
      }
    }

    return Reservations
  }

exports.initInstances = async ({ address, instances, replace, response }) => {
  const temp = (await exec({ command: 'mktemp -d' })).replace(/\s$/, '')

  const runningReservations = await cloud.describeInstances()

  for (let i = 0; i < instances.length; i++) {
    const instance = instances[i]
    const Reservations = await exports.initInstance({ address, instance, replace, response, temp })

    if (replace === true) {
      // !!!!!!!! Code below this line is not guaranteed to run on aliajs
      // since the code below is terminating instances. aliajs could
      // be terminated (shutdown) before it can finish this for loop.
      // That's why aliajs is the last item of instances[].
      for (const runningInstance of runningReservations) {
        if (new RegExp(`^${instance.name}-[a-z0-9]+$`).test(runningInstance.name)) {
          await cloud.deleteInstance({ instance: runningInstance })
        }
      }
    }
  }
}
