import './env.js'

import './items.js'

import { serve } from '@hono/node-server'
import app from './app.js'

const port = parseInt(process.env.PORT || '3000', 10)

const server = serve({ fetch: app.fetch, port })
server.setTimeout(500000)
