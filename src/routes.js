const log = require('./logger')(__filename)

const express = require('express')
const deploy = require('./deploy')
const { initInstances } = require('./new-instance')
const utils = require('./utils')
const { domains } = require('../configurations/domains')
const { instances } = require('../configurations/instances')

const router = express.Router()

router.get(`/domains`, async (request, response) => {
  response.json(domains)
})

router.get(`/deploy`, async (request, response) => {
  const { checkout, service_name, tier } = request.query
  try {
    const { instance, service } = utils.service({ instances, service_name, tier })
    const exec = utils.EXEC({ response })
    const ssh = {
      current: utils.SSH({ address: instance.address, keyName: process.env.ALIAJS_KEY_NAME, response }),
      new: utils.SSH({ address: instance.address, keyName: process.env.ALIAJS_KEY_NAME, response }),
    }
    await deploy[service.type]({ checkout, exec, service, ssh })
  } catch (error) {
    log.error({ error, message: `Error deploying service ${service_name}`, channel: 'operations' })
    response.write(`\x1b[31m${error}\x1b[0m\n`)
  }
  response.end()
})

router.get('/new-instance', async (request, response) => {
  let { address, checkout, instance_name, replace } = request.query

  try {
    if (typeof replace === 'string' && replace.match(/^true$/i)) {
      replace = true
    }
    await initInstances({ address, instances: [utils.instance({ instances, instance_name })], replace, response })
  } catch (error) {
    log.error({ error, message: `Error creating new instance ${instance_name}`, channel: 'operations' })
    response.write(`\x1b[31m${error}\x1b[0m\n`)
  }

  response.end()
})

module.exports = router
