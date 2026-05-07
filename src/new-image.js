require('dotenv').config({ path: `${__dirname}/../.env` })

const log = require('./logger')(__filename)

const items = require('./items')
const { newInstance } = require('./cloud/cloud.js')
const { install, SSH } = require('./utils')
const configurations = require('../configurations/images')

async function newImage() {
  const { Reservations } = await newInstance({
    imageName: process.env.ALIAJS_DEFAULT_IMAGE_NAME,
    keyName: process.env.ALIAJS_KEY_NAME,
    name: 'aliajs-new-image',
    type: process.env.ALIAJS_DEFAULT_TYPE,
  })
  console.log(require('util').inspect(Reservations, { depth: Infinity }))
}

newImage()
