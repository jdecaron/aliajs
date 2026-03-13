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

  await (await fetch(`https://api.machines.dev/v1/apps/${process.env.APP_NAME}/machines/${machine.id}/wait?state=started&instance_id=${machine.instance_id}`, {
    headers: { 'Authorization': `Bearer ${process.env.FLY_API_TOKEN}` }
  })).json()

  return {
    Reservations: [{
      Instances: [{
        InstanceId: machine.id,
        PrivateIpAddress: machine.private_ip,
        PublicIpAddress: address,
      }]
    }]
  }
}
