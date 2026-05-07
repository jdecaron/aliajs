require('dotenv').config({ path: `${__dirname}/../.env` })

const log = require('./logger')(__filename)

const items = require('./items')
const cloud = require('./cloud/cloud.js')
const { install, SSH } = require('./utils')
const configurations = require('../configurations/images')

async function newImage() {
  for (const image of configurations.images) {
    // const { Reservations } = await cloud.newInstance({
    //   imageName: image.ImageId,
    //   keyName: process.env.ALIAJS_KEY_NAME,
    //   name: 'aliajs-new-image',
    //   type: process.env.ALIAJS_DEFAULT_TYPE,
    // })

    // const instance = Reservations[0].Instances[0]
    const instance = {
      InstanceId: '129793892',
      PrivateIpAddress: undefined,
      PublicIpAddress: '5.161.226.7',
      type: 'cpx11'
    }

    // const ssh = SSH({ address: instance.PublicIpAddress, keyName: process.env.ALIAJS_KEY_NAME })
    // await install({
    //   path: process.env.ALIAJS_DEFAULT_PATH,
    //   major: image.major,
    //   ssh,
    //   user: process.env.ALIAJS_DEFAULT_USER,
    // })

    // Create new image.
    await cloud.createImage(({ instance, image }))
  }
}

newImage()
