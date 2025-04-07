require('dotenv').config()

const log = require('./logger')(__filename)

const { initInstances, setTelemetryInstance } = require('./new-instance')
const { SSH } = require('./utils')
const { domains } = require('../configurations/domains')
const { instances } = require('../configurations/instances')

async function refreshInstances() {
  try {
    try {
      // Stopping current prometheus-alertmanager service to prevent
      // alerts during refresh. It could be done in a better way but for
      // now I'm setting for a solution that works and doesn't cost too much
      // complexity or make the system more brittle. 2023-01-16, Jean-Denis Caron
      const ssh = SSH({ address: '3.97.235.183', keyName: process.env.ALIAJS_KEY_NAME })
      await ssh({ command: `sudo service snap.prometheus-alertmanager.alertmanager stop` })
    } catch (error) {
      log.error({ error, message: 'Error stopping prometheus-alertmanager service during instances refresh', channel: 'operations' })
    }
    await initInstances({ domains, instances, replace: true })
  } catch (error) {
    log.error({ error, message: 'Error refreshing instances', channel: 'operations' })
    await setTelemetryInstance({})
  }
}
refreshInstances()
