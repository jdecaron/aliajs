import './env.js'

import { fileURLToPath } from 'url'
import { initInstances } from './new-instance.js'
import { SSH } from './utils.js'
import { domains } from '../configurations/domains.js'
import { instances } from '../configurations/instances.js'
import logger from './logger.js'

const log = logger(fileURLToPath(import.meta.url))

async function refreshInstances() {
  try {
    await initInstances({ domains, instances, replace: true })
  } catch (error) {
    log.error({ error, message: 'Error refreshing instances', channel: 'operations' })
  }
}
refreshInstances()
