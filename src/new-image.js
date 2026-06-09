import './env.js'

import { fileURLToPath } from 'url'
import './items.js'
import * as cloud from './cloud/cloud.js'
import { install, SSH } from './utils.js'
import * as configurations from '../configurations/images.js'
import logger from './logger.js'

const log = logger(fileURLToPath(import.meta.url))

async function newImage() {
  for (const image of configurations.images) {
    await cloud.deleteImages({ description: image.Name })

    const { Reservations } = await cloud.newInstance({
      imageName: image.ImageId,
      keyName: process.env.ALIAJS_KEY_NAME,
      name: 'aliajs-new-image',
      type: process.env.ALIAJS_DEFAULT_TYPE,
    })

    const instance = Reservations[0].Instances[0]

    const ssh = SSH({ address: instance.PublicIpAddress, keyName: process.env.ALIAJS_KEY_NAME })
    await install({
      path: process.env.ALIAJS_DEFAULT_PATH,
      major: image.major,
      ssh,
      user: process.env.ALIAJS_DEFAULT_USER,
    })

    // Create new image.
    await cloud.createImage(({ instance, image }))

    // Delete instance
    await cloud.deleteInstance({ instance })
  }
}

newImage()
