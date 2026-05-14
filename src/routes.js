const log = require('./logger')(__filename)

const { Hono } = require('hono')
const { streamText } = require('hono/streaming')
const deploy = require('./deploy')
const { initInstances } = require('./new-instance')
const utils = require('./utils')
const { domains } = require('../configurations/domains')
const { instances } = require('../configurations/instances')

const router = new Hono()

router.get('/domains', (c) => {
  return c.json(domains)
})

router.get('/deploy', (c) => {
  const { checkout, service_name, tier } = c.req.query()
  return streamText(c, async (stream) => {
    try {
      const { instance, service } = utils.service({ instances, service_name, tier })
      const exec = utils.EXEC({ response: stream })
      const ssh = {
        current: utils.SSH({ address: instance.address, keyName: process.env.ALIAJS_KEY_NAME, response: stream }),
        new: utils.SSH({ address: instance.address, keyName: process.env.ALIAJS_KEY_NAME, response: stream }),
      }
      await deploy[service.type]({ checkout, exec, service, ssh })
    } catch (error) {
      log.error({ error, message: `Error deploying service ${service_name}`, channel: 'operations' })
      await stream.write(`\x1b[31m${error}\x1b[0m\n`)
    }
  })
})

router.get('/new-instance', (c) => {
  let { address, instance_name, replace } = c.req.query()
  return streamText(c, async (stream) => {
    try {
      if (typeof replace === 'string' && replace.match(/^true$/i)) replace = true
      await initInstances({ address, instances: [utils.instance({ instances, instance_name })], replace, response: stream })
    } catch (error) {
      log.error({ error, message: `Error creating new instance ${instance_name}`, channel: 'operations' })
      await stream.write(`\x1b[31m${error}\x1b[0m\n`)
    }
  })
})

module.exports = router
