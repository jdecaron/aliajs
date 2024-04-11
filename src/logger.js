const { hostname } = require('os')
const bole = require('bole')

bole.output({
    hostname,
    level: process.env.LOG_LEVEL || 'error',
    stream: process.stdout,
})

module.exports = bole(process.env.APP_NAME)
