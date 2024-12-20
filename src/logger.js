const { hostname } = require('os')
const bole = require('bole')

if (!('toJSON' in Error.prototype)) {
  // See this link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#:~:text=Only%20enumerable%20own%20properties%20are%20visited to understand the why of these line below. bole use fast-safe-stringify which use JSON.stringify() which stringify Error objects into an empty {}.
  Object.defineProperty(Error.prototype, 'toJSON', {
    value: function () {
      var alt = {}

      Object.getOwnPropertyNames(this).forEach(function (key) {
        alt[key] = this[key]
      }, this)

      return alt
    },
    configurable: true,
    writable: true
  })
}

bole.output({
    hostname,
    level: process.env.LOG_LEVEL || 'error',
    stream: process.stdout,
})

module.exports = bole(process.env.APP_NAME)
