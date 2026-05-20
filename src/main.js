require('dotenv').config()

require('./items')

const { serve } = require('@hono/node-server')
const app = require('./app')

const port = parseInt(process.env.PORT || '3000', 10)

const server = serve({ fetch: app.fetch, port })
server.setTimeout(500000)
