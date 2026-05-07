require('dotenv').config()

const fetch = require('node-fetch')

const log = require('../logger')(__filename)

exports.hetznerNewInstance = async ({ address, imageName, keyName, instance, name, type }) => {
  const result = await (await fetch('https://api.hetzner.cloud/v1/servers', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.HETZNER_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name,
      server_type: type,
      image: imageName,
      location: process.env.ALIAJS_DEFAULT_REGION,
      ssh_keys: [keyName],
    })
  })).json()

  if (result.error) {
    throw new Error(`hetzner server create: ${result.error.message}`)
  }

  const { server, action } = result
  let actionStatus = action.status
  while (actionStatus === 'running') {
    await new Promise(r => setTimeout(r, 2000))
    const actionResult = await (await fetch(`https://api.hetzner.cloud/v1/actions/${action.id}`, {
      headers: { 'Authorization': `Bearer ${process.env.HETZNER_API_TOKEN}` }
    })).json()
    if (actionResult.action.status === 'error') {
      throw new Error(`hetzner server start: ${actionResult.action.error.message}`)
    }
    actionStatus = actionResult.action.status
  }

  return {
    Reservations: [{
      Instances: [{
        InstanceId: String(server.id),
        PrivateIpAddress: server.private_net?.[0]?.ip,
        PublicIpAddress: server.public_net.ipv4.ip,
        type,
      }]
    }]
  }
}
