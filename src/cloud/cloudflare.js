import '../env.js'

import ky from 'ky'
import { fileURLToPath } from 'url'
import logger from '../logger.js'

const log = logger(fileURLToPath(import.meta.url))

export const upsertARecord = async ({ instance, name: inputName, zone }) => {
  const name = `${inputName}.${zone}`
  const headers = {
    'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
    'Content-Type': 'application/json',
  }

  const { result: zones } = await ky(`https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(zone)}`, {
    headers,
  }).json()
  const filteredZones = zones.filter((z) => {
    return z.name === zone
  })
  const zoneID = filteredZones[0].id

  const { result: activeRecords } = await ky(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneID)}/dns_records?per_page=1024`, {
    headers,
  }).json()

  const filteredRecords = activeRecords.filter((record) => {
    return record.name === name
  })

  for (const record of filteredRecords) {
    const deleteResult = await ky(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneID)}/dns_records/${record.id}`, {
      method: 'DELETE',
      headers,
    })
  }

  const result = await ky(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneID)}/dns_records`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name,
      type: 'A',
      ttl: 300,
      content: instance.PublicIpAddress,
    })
  }).json()
}

export const upsertDNSZone = async ({ }) => { }
