const dotenv = require('dotenv').config()

const { serve } =  require('@hono/node-server')
const { Hono } = require('hono')
const routes = require('./routes')

const app = new Hono()

app.route('/', routes)

console.log(`Server is running on port ${process.env.PORT}`)

serve({
  fetch: app.fetch,
  port: process.env.PORT,
})
