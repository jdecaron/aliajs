const crypto = require('crypto')
const { Hono } = require('hono')
const routes = require('./routes')

const log = require('./logger')(__filename)

const app = new Hono()

app.use('*', async (c, next) => {
  const authorization = c.req.header('Authorization')
  if (typeof authorization === 'string' && crypto.timingSafeEqual(Buffer.from(process.env.ALIAJS_AUTHORIZATION), Buffer.from(authorization))) {
    await next()
  } else {
    return c.json({}, 400)
  }
})

app.route('/', routes)

app.onError((error, c) => {
  log.error({ error })
  return c.text('{"type":"unknown","message":"Server internal error"}', 500)
})

module.exports = app
