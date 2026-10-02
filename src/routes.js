import dns from 'dns'
import { fileURLToPath } from 'url'
import { Hono } from 'hono'
import { streamText } from 'hono/streaming'
import util from 'util'
import * as deploy from './deploy.js'
import { initInstances } from './new-instance.js'
import * as utils from './utils.js'
import logger from './logger.js'
import { domains } from '../configurations/domains.js'
import { instances } from '../configurations/instances.js'

const log = logger(fileURLToPath(import.meta.url))

const lookup = util.promisify(dns.lookup)

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

      let address = instance.address
      if (address === undefined) {
        try {
          address = (await lookup(`${instance.name}.${process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN}`)).address
        } catch (error) {
          log.warn(`WARNING! Could not lookup DNS ${`${instance.name}.${process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN}`} (it can be OK)`)
        }
      }

      const ssh = {
        current: utils.SSH({ address, keyName: process.env.ALIAJS_KEY_NAME, response: stream }),
        new: utils.SSH({ address, keyName: process.env.ALIAJS_KEY_NAME, response: stream }),
      }
      await deploy[service.type]({ checkout, exec, service, ssh })
    } catch (error) {
      log.error({ error, message: `Error deploying service ${service_name}`, channel: 'operations' })
      await stream.write(`\x1b[31m${error}\x1b[0m\n`)
    }
  })
})

router.get('/new-instance', (c) => {
  let { address, ephemeral, instance_name, replace } = c.req.query()
  return streamText(c, async (stream) => {
    try {
      const flags = { exclude: c.req.queries('exclude') || [], target: c.req.queries('target') || [] }
      if (typeof replace === 'string' && replace.match(/^true$/i)) replace = true
      await initInstances({ address, ephemeral, flags, instances: [utils.instance({ instances, instance_name })], replace, response: stream })
    } catch (error) {
      log.error({ error, message: `Error creating new instance ${instance_name}`, channel: 'operations' })
      await stream.write(`\x1b[31m${error}\x1b[0m\n`)
    }
  })
})

export default router
