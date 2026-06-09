import '../env.js'

import { fileURLToPath } from 'url'
import * as hetzner from './hetzner.js'
import logger from '../logger.js'

const log = logger(fileURLToPath(import.meta.url))

function cloud() {
  return hetzner
}

export const newInstance = async ({ address, imageName, keyName, instance, name, type }) => {
  return await cloud().newInstance({ address, imageName, keyName, instance, name, type })
}

export const createImage = async ({ instance, image }) => {
  return await cloud().createImage({ instance, image })
}

export const deleteInstance = async ({ instance }) => {
  return await cloud().deleteInstance({ instance })
}

export const deleteImages = async ({ description }) => {
  return await cloud().deleteImagesByDescription(description)
}

export const associateAddress = async ({ instance, ssh }) => {
  return await cloud().associateAddress({ instance, ssh })
}

export const describeInstances = async () => {
  return await cloud().describeInstances()
}


export const upsertARecord = async ({ instance, name, zone }) => {
  return await cloud().upsertARecord({ instance, name, zone })
}
