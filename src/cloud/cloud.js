require('dotenv').config()

const log = require('../logger')(__filename)

const hetzner = require('./hetzner.js')

function cloud() {
  return hetzner
}

exports.newInstance = async ({ address, imageName, keyName, instance, name, type }) => {
  return await cloud().newInstance({ address, imageName, keyName, instance, name, type })
}

exports.createImage = async ({ instance, image }) => {
  return await cloud().createImage({ instance, image })
}

exports.deleteInstance = async ({ instance }) => {
  return await cloud().deleteInstance({ instance })
}

exports.deleteImages = async ({ description }) => {
  return await cloud().deleteImagesByDescription(description)
}

exports.associateAddress = async ({ instance, ssh }) => {
  return await cloud().associateAddress({ instance, ssh })
}

exports.describeInstances = async () => {
  return await cloud().describeInstances()
}
