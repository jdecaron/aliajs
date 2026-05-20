require('dotenv').config()

const log = require('./logger')(__filename)

const { initInstances } = require('./new-instance')
const { SSH } = require('./utils')
const { domains } = require('../configurations/domains')
const { instances } = require('../configurations/instances')

async function refreshInstances() {
  try {
    await initInstances({ domains, instances, replace: true })
  } catch (error) {
    log.error({ error, message: 'Error refreshing instances', channel: 'operations' })
  }
}
refreshInstances()
