require('dotenv').config()

const fetch = require('node-fetch')

const log = require('../logger')(__filename)

exports.flyioNewInstance = async ({ address, imageName, keyName, instance, name, type }) => {
  const machine = await (await fetch(`https://api.machines.dev/v1/apps/${process.env.APP_NAME}/machines`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.FLY_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      region: instance.type.region,
      config: {
        image: 'ubuntu:24.04',
        guest: {
          memory_mb: instance.type.memory_mb,
          cpus: instance.type.cpus,
          cpu_kind: instance.type.cpu_kind
        },
        init: {
          exec: ["/bin/sleep", "infinity"]
        },
      }
    })
  })).json()
  if (machine.error) {
    throw new Error(`flyio machine create: ${machine.error}`)
  }

  const waitResult = await (await fetch(`https://api.machines.dev/v1/apps/${process.env.APP_NAME}/machines/${machine.id}/wait?state=started`, {
    headers: { 'Authorization': `Bearer ${process.env.FLY_API_TOKEN}` }
  })).json()
  if (waitResult.error) {
    throw new Error(`flyio machine wait: ${waitResult.error}`)
  }

  return {
    Reservations: [{
      Instances: [{
        InstanceId: machine.id,
        PrivateIpAddress: machine.private_ip,
        PublicIpAddress: address,
        type: JSON.parse(JSON.stringify(instance.type)),
      }]
    }]
  }
}
