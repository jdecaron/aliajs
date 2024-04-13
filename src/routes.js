const log = require('./logger')(__filename)
const utils = require('./utils')

const { Hono } = require('hono')
// const { initInstances } = require('../new-instance')

const app = new Hono()

app.get('/new-instance', async (context) => {
    let { address, checkout, instance_name, replace } = context.req.query()

    try {
        if (typeof replace === 'string' && replace.match(/^true$/i)) {
            replace = true
        }
        await initInstances({ address, checkout, instances: [utils.instance({ instances, instance_name })], replace, response: context })
    } catch (error) {
        log.error({ error, message: `Error creating new instance ${instance_name}`, slack: 'operations' })
        context.status(500)
        return context.body(`\x1b[31m${error}\x1b[0m\n`)
    }
})

module.exports = app
