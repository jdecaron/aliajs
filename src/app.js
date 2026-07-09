import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { Hono } from 'hono'
import routes from './routes.js'
import logger from './logger.js'

const log = logger(fileURLToPath(import.meta.url))

const app = new Hono()

app.get('/404-uc3C6', (c) => {
  return c.notFound()
})

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

export default app
