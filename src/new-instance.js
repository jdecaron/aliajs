import './env.js'

import dns from 'dns'
import fs from 'fs'
import { fileURLToPath } from 'url'
import util from 'util'
import * as cloud from './cloud/cloud.js'
import * as deploy from './deploy.js'
import { getNotes, items } from './items.js'
import { getDomain, exec, SSH } from './utils.js'
import * as configurations from '../configurations/instances.js'
import logger from './logger.js'

const log = logger(fileURLToPath(import.meta.url))

const lookup = util.promisify(dns.lookup)

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

export const initInstance = async ({ address, instance, refresh, replace, response, temp }) => {
  const { imageName, name, services, type } = instance

  const keyName = instance.keyName || process.env.ALIAJS_KEY_NAME
  instance.address = instance.address || (await lookup(`${instance.name}.${process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN}`)).address
  const { Reservations } = await cloud.newInstance({ address, imageName, keyName, instance, name: `${name}-${Math.random().toString(36).slice(2, 8)}`, type })
  // const Reservations = [{
  //   Instances: [{
  //     InstanceId: '142769447',
  //     PublicIpAddress: '5.78.180.28',
  //   }],
  // }]
  instance.InstanceId = Reservations[0].Instances[0].InstanceId
  instance.PublicIpAddress = Reservations[0].Instances[0].PublicIpAddress

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
    } else {
      await cloud.upsertARecord({ instance, name: instance.name, zone: process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN })
      for (const service of services) {

        await cloud.upsertARecord({ instance, name: `${service.name}-${service.tier}`, zone: process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN })
      }
      await new Promise(r => setTimeout(r, 5 * 60 * 1000))
    }
  }

  return Reservations
}

export const initInstances = async ({ address, instances, replace, response }) => {
  const temp = (await exec({ command: 'mktemp -d' })).replace(/\s$/, '')

  const runningReservations = await cloud.describeInstances()

  for (let i = 0; i < instances.length; i++) {
    const instance = instances[i]
    const Reservations = await initInstance({ address, instance, replace, response, temp })

    if (replace === true) {
      // Cloud instance deletion is the last thing to run for some reasons.
      for (const runningInstance of runningReservations) {
        if (new RegExp(`^${instance.name}-[a-z0-9]+$`).test(runningInstance.name)) {
          await cloud.deleteInstance({ instance: runningInstance })
        }
      }
    }
  }
}
