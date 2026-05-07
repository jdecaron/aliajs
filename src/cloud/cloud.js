require('dotenv').config()

const log = require('../logger')(__filename)

const { flyioNewInstance } = require('./flyio.js')
const { hetznerNewInstance } = require('./hetzner.js')

exports.newInstance = async ({ address, imageName, keyName, instance, name, type }) => {
  return await hetznerNewInstance({ address, imageName, keyName, instance, name, type })
}

exports.createImage = async ({ address, imageName, keyName, instance, name, type }) => {
  return await hetznerCreateImage({ address, imageName, keyName, instance, name, type })
}
