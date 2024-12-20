const express = require('express')
const schedule = require('node-schedule')
const rp = require('request-promise')
const sslChecker = require('ssl-checker')

const log = logger.child({ __filename })

const router = express.Router()

router.all(`/test`, (req, res) => {
  test(req, res)
})

function wildcard({ domain }) {
  const wildcards = {
    '*.rotat.io': 'aliajs-production.rotat.io',
  }

  if (typeof wildcards[domain] === 'string') {
    return wildcards[domain]
  }

  return domain
}

async function test(req, res) {
  try {
    let domains = []
    let result = await rp(`https://aliajs-production.rotat.io/domains`, { json: true })
    for (let i = 0; i < result.length; i++) {
      domains = domains.concat(result[i].domains)
    }
    log.info({ message: `Testing certificates for domains: ${domains.join(', ')}`, channel: 'certificates' })
    for (let i = 0; i < domains.length; i++) {
      const domain = wildcard({ domain: domains[i] })
      try {
        const result = await sslChecker(domain, { method: 'GET', rejectUnauthorized: true })
        if (result.daysRemaining < 30) {
          log.info({ message: `Certificate will expire in ${result.daysRemaining} day(s) for ${domain}`, channel: 'certificates' })
        }
      } catch(error) {
        res.status(500)
        log.error({ error, message: `SSL error for domain ${domain}`, channel: 'certificates' })
      }
    }
  } catch (error) {
    res.status(500)
    log.error({ error, channel: 'certificates' })
  }
  res.end()
}

const noOperationRes = {
  // This object is a mock of the Express response object.
  // 'function test' be called from an express route but it can also
  // be called by the setInterval which doesn't contain a response object
  // and doesn't need to respond to an HTTP request.
  end: () => {},
  status: () => {},
}

// schedule.scheduleJob('0 0 0 * * 1', function () {
schedule.scheduleJob('0 0 0 * * *', function () {
  test({}, noOperationRes)
})

module.exports = router
