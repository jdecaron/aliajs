import '../env.js'

import { fileURLToPath } from 'url'
import * as hetzner from './hetzner.js'
import logger from '../logger.js'

const log = logger(fileURLToPath(import.meta.url))

function cloud() {
  return hetzner
}

export const associateAddress = async ({ instance, ssh }) => {
  return await cloud().associateAddress({ instance, ssh })
}

export const createBucket = async ({ name, region }) => {
  return await cloud().createBucket({ name, region })
}

export const createImage = async ({ instance, image }) => {
  return await cloud().createImage({ instance, image })
}

export const createKey = async ({ key }) => {
  return await cloud().createKey({ key })
}

export const deleteInstance = async ({ instance }) => {
  return await cloud().deleteInstance({ instance })
}

export const deleteImages = async ({ description }) => {
  return await cloud().deleteImagesByDescription(description)
}

export const describeInstances = async () => {
  return await cloud().describeInstances()
}

export const newInstance = async ({ address, imageName, keyName, instance, name, type }) => {
  return await cloud().newInstance({ address, imageName, keyName, instance, name, type })
}

export const upsertARecord = async ({ instance, name, zone }) => {
  return await cloud().upsertARecord({ instance, name, zone })
}

export const upsertDNSZone = async ({ name }) => {
  return await cloud().upsertDNSZone({ name })
}
