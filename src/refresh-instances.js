import 'dotenv/config'
import { fileURLToPath } from 'url'
import logger from './logger.js'
import { initInstances } from './new-instance.js'
import { SSH } from './utils.js'
import { domains } from '../configurations/domains.js'
import { instances } from '../configurations/instances.js'

const __filename = fileURLToPath(import.meta.url)
const log = logger(__filename)

async function refreshInstances() {
  try {
    await initInstances({ domains, instances, replace: true })
  } catch (error) {
    log.error({ error, message: 'Error refreshing instances', channel: 'operations' })
  }
}
refreshInstances()
