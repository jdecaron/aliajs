const dotenv = require('dotenv').config()
const crypto = require('crypto')

const { serve } =  require('@hono/node-server')
const { Hono } = require('hono')
const routes = require('./routes')

const app = new Hono()

app.use(async (context, next) => {
  const authorization = context.req.header('Authorization')
  if (typeof authorization === 'string' && crypto.timingSafeEqual(Buffer.from(process.env.ALIAJS_AUTHORIZATION), Buffer.from(authorization))) {
    await next()
  } else {
    return context.json({}, 401)
  }
})

app.route('/', routes)

console.log(`Server is running on port ${process.env.PORT}`)

serve({
  fetch: app.fetch,
  port: process.env.PORT,
})
