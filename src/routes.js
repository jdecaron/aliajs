const log = require('./logger')(__filename)

const express = require('express')
const { initInstances } = require('./new-instance')
const utils = require('./utils')
const { instances } = require('../configurations/instances')

const router = express.Router()

router.get('/new-instance', async (request, response) => {
  let { address, checkout, instance_name, replace } = request.query

  try {
    if (typeof replace === 'string' && replace.match(/^true$/i)) {
      replace = true
    }
    await initInstances({ address, instances: [utils.instance({ instances, instance_name })], replace, response })
  } catch (error) {
    log.error({ error, message: `Error creating new instance ${instance_name}`, slack: 'operations' })
    response.write(`\x1b[31m${error}\x1b[0m\n`)
  }

  response.end()
})

module.exports = router
