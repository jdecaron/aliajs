require('dotenv').config()

const log = require('../logger')(__filename)

const { flyioNewInstance } = require('./flyio.js')
const { hetznerNewInstance } = require('./hetzner.js')

exports.newInstance = async ({ address, imageName, keyName, instance, name, type }) => {
  if (instance?.type?.type === 'flyio') {
    return await flyioNewInstance({ address, imageName, keyName, instance, name, type })
  }else if (instance?.type?.type === 'hetzner') {
    return await hetznerNewInstance({ address, imageName, keyName, instance, name, type })
  }

  if (process.env.ALIAJS_DEFAULT_CLOUD === 'flyio') {
    return await flyioNewInstance({ address, imageName, keyName, instance, name, type })
  }else if (process.env.ALIAJS_DEFAULT_CLOUD === 'hetzner') {
    return await hetznerNewInstance({ address, imageName, keyName, instance, name, type })
  }
}
