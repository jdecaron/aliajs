const crypto = require('crypto')
const express = require('express')
const routes = require('./routes')

const log = require('./logger')(__filename)

const app = express()

app.disable('x-powered-by')

app.use(express.json({ limit: '5mb' }))
app.use(express.urlencoded({ extended: false }))

app.use(async (request, response, next) => {
  const authorization = request.header('Authorization')
  if (typeof authorization === 'string' && crypto.timingSafeEqual(Buffer.from(process.env.ALIAJS_AUTHORIZATION), Buffer.from(authorization))) {
    await next()
  } else {
    return response.json({}, 400)
  }
})

app.use('/', routes)

app.use((error, request, response, next) => {
  log.error({ error, request })
  response.setHeader('Content-Type', 'application/json')
  response.status(500).end(`{"type":"unknown","message":"Server internal error"}`)
})

module.exports = app
