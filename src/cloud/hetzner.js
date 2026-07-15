import '../env.js'

import ky from 'ky'
import { fileURLToPath } from 'url'
import logger from '../logger.js'

const log = logger(fileURLToPath(import.meta.url))

export const upsertARecord = async ({ instance, name, zone }) => {
  const headers = {
    'Authorization': `Bearer ${process.env.HETZNER_API_TOKEN}`,
    'Content-Type': 'application/json',
  }

  const { rrsets } = await ky(`https://api.hetzner.cloud/v1/zones/${encodeURIComponent(zone)}/rrsets?per_page=100`, {
    headers,
  }).json()

  const filteredRrsets = rrsets.filter((rrset) => {
    return rrset.name === name
  })

  const records = [{ value: instance.PublicIpAddress }]
  if (filteredRrsets.length > 0) {
    const deleteResult = await ky(`https://api.hetzner.cloud/v1/zones/${encodeURIComponent(zone)}/rrsets/${name}/A`, {
      method: 'DELETE',
      headers,
    })
  }

  const result = await ky(`https://api.hetzner.cloud/v1/zones/${encodeURIComponent(zone)}/rrsets`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name,
      type: 'A',
      ttl: 300,
      records,
    })
  }).json()
}

export const createImage = async ({ instance, image }) => {
  const result = await ky(`https://api.hetzner.cloud/v1/servers/${instance.InstanceId}/actions/create_image`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.HETZNER_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      description: image.Name,
      type: 'snapshot',
      labels: {
        description: image.Name,
      }
    })
  }).json()

  const { image: snapshot, action } = result
  let actionStatus = action.status
  while (actionStatus === 'running') {
    await new Promise(r => setTimeout(r, 2000))
    actionStatus = (await ky(`https://api.hetzner.cloud/v1/actions/${action.id}`, {
      headers: { 'Authorization': `Bearer ${process.env.HETZNER_API_TOKEN}` }
    }).json()).action.status
  }

  return { ImageId: String(snapshot.id) }
}

export const deleteInstance = async ({ instance }) => {
  const result = await ky(`https://api.hetzner.cloud/v1/servers/${instance.InstanceId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${process.env.HETZNER_API_TOKEN}` }
  }).json()
}

const getSnapshotByDescription = async (description) => {
  const result = await ky(`https://api.hetzner.cloud/v1/images?type=snapshot&sort=created:desc&label_selector=description%3D${description}`, {
    headers: { 'Authorization': `Bearer ${process.env.HETZNER_API_TOKEN}` }
  }).json()

  return result?.images?.[0]?.id
}

export const renameInstance = async ({ instance, name }) => {
  const result = await ky(`https://api.hetzner.cloud/v1/servers/${instance.InstanceId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${process.env.HETZNER_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name })
  }).json()
}

export const describeInstances = async () => {
  const result = await ky('https://api.hetzner.cloud/v1/servers', {
    headers: { 'Authorization': `Bearer ${process.env.HETZNER_API_TOKEN}` }
  }).json()

  return result.servers.map(server => ({
    InstanceId: String(server.id),
    name: server.name,
    PublicIpAddress: server.public_net.ipv4.ip,
    PrivateIpAddress: server.private_net?.[0]?.ip,
  }))
}

export const associateAddress = async ({ instance, ssh }) => {
  const listResult = await ky(`https://api.hetzner.cloud/v1/floating_ips?page=1&per_page=50`, {
    headers: { 'Authorization': `Bearer ${process.env.HETZNER_API_TOKEN}` }
  }).json()

  const floatingIp = listResult.floating_ips.find(f => f.ip === instance.address)
  if (!floatingIp) {
    throw new Error(`hetzner associate address: floating ip ${instance.address} not found`)
  }

  const assignResult = await ky(`https://api.hetzner.cloud/v1/floating_ips/${floatingIp.id}/actions/assign`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.HETZNER_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ server: Number(instance.InstanceId) })
  }).json()

  await ssh.new({ command: `sudo ip addr add ${instance.address} dev eth0` })
  await ssh.new({ command: `sudo mkdir -p /etc/network/interfaces.d` })
  await ssh.new({ command: `echo 'auto eth0:1\niface eth0:1 inet static\n    address ${instance.address}\n    netmask 255.255.255.255' | sudo tee /etc/network/interfaces.d/60-my-floating-ip.cfg` })
}

export const deleteImagesByDescription = async (description) => {
  const result = await ky(`https://api.hetzner.cloud/v1/images?type=snapshot&label_selector=description%3D${description}`, {
    headers: { 'Authorization': `Bearer ${process.env.HETZNER_API_TOKEN}` }
  }).json()

  for (const image of result.images) {
    const deleteResult = await ky(`https://api.hetzner.cloud/v1/images/${image.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${process.env.HETZNER_API_TOKEN}` }
    })
  }
}

export const newInstance = async ({ address, imageName, keyName, instance, name, type }) => {
  const image = await getSnapshotByDescription(imageName) || process.env.ALIAJS_DEFAULT_IMAGE_NAME

  const { server, action } = await ky('https://api.hetzner.cloud/v1/servers', {
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
      public_net: {
        enable_ipv4: true,
        enable_ipv6: true,
      },
    })
  }).json()

  let actionStatus = action.status
  while (actionStatus === 'running') {
    await new Promise(r => setTimeout(r, 2000))
    const actionResult = await ky(`https://api.hetzner.cloud/v1/actions/${action.id}`, {
      headers: { 'Authorization': `Bearer ${process.env.HETZNER_API_TOKEN}` }
    }).json()
    actionStatus = actionResult.action.status
  }

  return {
    Reservations: [{
      Instances: [{
        InstanceId: String(server.id),
        PrivateIpAddress: server.private_net?.[0]?.ip,
        PublicIpAddress: server.public_net.ipv4?.ip,
        PublicIpv6Address: server.public_net.ipv6?.ip,
        type,
      }]
    }]
  }
}
