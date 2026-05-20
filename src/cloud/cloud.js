import 'dotenv/config'
import { fileURLToPath } from 'url'
import logger from '../logger.js'
import * as hetzner from './hetzner.js'

const __filename = fileURLToPath(import.meta.url)
const log = logger(__filename)

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
