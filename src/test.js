const bole = require('bole')

bole.output({
  level: 'info',
  stream: process.stdout
})

const log = bole('server')
const sub = log('sub')

sub.info({ sauce: 1111 })
