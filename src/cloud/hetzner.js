require('dotenv').config()

const log = require('../logger')(__filename)

exports.createImage = async ({ instance, image }) => {
  const result = await (await fetch(`https://api.hetzner.cloud/v1/servers/${instance.InstanceId}/actions/create_image`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.HETZNER_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      description: image.Name,
      type: 'snapshot',
    })
  })).json()

  if (result.error) {
    throw new Error(`hetzner create image: ${result.error.message}`)
  }

  const { image: snapshot, action } = result
  let actionStatus = action.status
  while (actionStatus === 'running') {
    await new Promise(r => setTimeout(r, 2000))
    const actionResult = await (await fetch(`https://api.hetzner.cloud/v1/actions/${action.id}`, {
      headers: { 'Authorization': `Bearer ${process.env.HETZNER_API_TOKEN}` }
    })).json()
    if (actionResult.action.status === 'error') {
      throw new Error(`hetzner create image action: ${actionResult.action.error.message}`)
    }
    actionStatus = actionResult.action.status
  }

  return { ImageId: String(snapshot.id) }
}

exports.deleteInstance = async ({ instance }) => {
  const result = await (await fetch(`https://api.hetzner.cloud/v1/servers/${instance.InstanceId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${process.env.HETZNER_API_TOKEN}` }
  })).json()

  if (result.error) {
    throw new Error(`hetzner delete instance: ${result.error.message}`)
  }
}

const getSnapshotByDescription = async (description) => {
  const result = await (await fetch(`https://api.hetzner.cloud/v1/images?type=snapshot&description=${encodeURIComponent(description)}&sort=created:desc`, {
    headers: { 'Authorization': `Bearer ${process.env.HETZNER_API_TOKEN}` }
  })).json()

  if (result.error) {
    throw new Error(`hetzner list images: ${result.error.message}`)
  }

  return result?.images?.[0]?.id
}

exports.renameInstance = async ({ instance, name }) => {
  const result = await (await fetch(`https://api.hetzner.cloud/v1/servers/${instance.InstanceId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${process.env.HETZNER_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name })
  })).json()

  if (result.error) {
    throw new Error(`hetzner rename instance: ${result.error.message}`)
  }
}

exports.describeInstances = async () => {
  const result = await (await fetch('https://api.hetzner.cloud/v1/servers', {
    headers: { 'Authorization': `Bearer ${process.env.HETZNER_API_TOKEN}` }
  })).json()

  if (result.error) {
    throw new Error(`hetzner list servers: ${result.error.message}`)
  }

  return result.servers.map(server => ({
    InstanceId: String(server.id),
    name: server.name,
    PublicIpAddress: server.public_net.ipv4.ip,
    PrivateIpAddress: server.private_net?.[0]?.ip,
  }))
}

exports.associateAddress = async ({ instance, ssh }) => {
  const listResult = await (await fetch(`https://api.hetzner.cloud/v1/floating_ips?page=1&per_page=50`, {
    headers: { 'Authorization': `Bearer ${process.env.HETZNER_API_TOKEN}` }
  })).json()

  if (listResult.error) {
    throw new Error(`hetzner list floating ips: ${listResult.error.message}`)
  }

  const floatingIp = listResult.floating_ips.find(f => f.ip === instance.address)
  if (!floatingIp) {
    throw new Error(`hetzner associate address: floating ip ${instance.address} not found`)
  }

  const assignResult = await (await fetch(`https://api.hetzner.cloud/v1/floating_ips/${floatingIp.id}/actions/assign`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.HETZNER_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ server: Number(instance.InstanceId) })
  })).json()

  if (assignResult.error) {
    throw new Error(`hetzner assign floating ip: ${assignResult.error.message}`)
  }

  await ssh.new({ command: `sudo ip addr add ${instance.address} dev eth0` })
  await ssh.new({ command: `sudo mkdir -p /etc/network/interfaces.d` })
  await ssh.new({ command: `echo 'auto eth0:1\niface eth0:1 inet static\n    address ${instance.address}\n    netmask 255.255.255.255' | sudo tee /etc/network/interfaces.d/60-my-floating-ip.cfg` })
}

exports.deleteImagesByDescription = async (description) => {
  const result = await (await fetch(`https://api.hetzner.cloud/v1/images?type=snapshot&description=${encodeURIComponent(description)}`, {
    headers: { 'Authorization': `Bearer ${process.env.HETZNER_API_TOKEN}` }
  })).json()

  if (result.error) {
    throw new Error(`hetzner list images: ${result.error.message}`)
  }

  for (const image of result.images) {
    const deleteResult = await (await fetch(`https://api.hetzner.cloud/v1/images/${image.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${process.env.HETZNER_API_TOKEN}` }
    })).json()

    if (deleteResult.error) {
      throw new Error(`hetzner delete image: ${deleteResult.error.message}`)
    }
  }
}

exports.newInstance = async ({ address, imageName, keyName, instance, name, type }) => {
  const image = await getSnapshotByDescription(imageName) || process.env.ALIAJS_DEFAULT_IMAGE_ID

  const response = await fetch('https://api.hetzner.cloud/v1/servers', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.HETZNER_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name,
      server_type: type || process.env.ALIAJS_DEFAULT_TYPE,
      image,
      location: process.env.ALIAJS_DEFAULT_REGION,
      ssh_keys: [keyName],
    })
  })

  if (response.status >= 400) {
    const errorResult = await response.json()
    throw new Error(`hetzner server create: ${errorResult.error.message}`)
  }

  const { server, action } = await response.json()
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
