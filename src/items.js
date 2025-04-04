const dotenv = require('dotenv')

const child_process = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const log = require('./logger')(__filename)

exports.getItem = ({ items, name }) => {
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.name === name) {
      return item
    }
  }

  throw Error(`getItem: Could not find any item named '${name}'`)
}

exports.getNotes = ({ items, name, systemdEscape }) => {
  try {
    const item = exports.getItem({ items, name })
    if (systemdEscape === true) {
      return JSON.stringify(item.notes)
    }
    return item.notes
  } catch (error) {
    throw Error(`getItem: Could not get item.notes from item name '${name}'`)
  }
}

exports.getItems = ({ variables }) => {
  const env = Object.assign({}, process.env, {
    BW_CLIENTID: variables[0],
    BW_CLIENTSECRET: variables[1],
    BW_PASSWORD: variables[2],
  })

  try {
    child_process.execSync('bw logout', { stdio: 'ignore' })
  } catch (error) {
    // Ignoring this error, 'bw logout' is run only to prevent a login attempt
    // below on an already logged in Bitwarden client.
  }

  let items = []
  try {
    child_process.execSync('bw login --apikey', { env, encoding: 'utf8' })
    env.BW_SESSION = child_process.execSync('bw unlock --raw --passwordenv BW_PASSWORD', { env, encoding: 'utf8' })
    child_process.execSync('bw sync', { env, encoding: 'utf8' })
    const result = child_process.execSync('bw list items', { env, encoding: 'utf8' })
    items = JSON.parse(result)
    child_process.execSync('bw logout')
  } catch (error) {
    log.error({ error, channel: 'operations' })
    child_process.execSync('bw logout')
    throw Error(`getItems: Could not get items for '${variables?.[0]}'`)
  }

  if (items.length === 0) {
    throw Error(`getItems: items.length === 0 for '${variables?.[0]}'`)
  }

  return items
}

exports.setItems = ({ index, items }) => {
  const variables = JSON.parse(exports.getNotes({ items: exports.items.operations, name: 'variables' }))[index]
  const env = Object.assign({}, process.env, {
    BW_CLIENTID: variables[0],
    BW_CLIENTSECRET: variables[1],
    BW_PASSWORD: variables[2],
  })

  try {
    child_process.execSync('bw logout', { stdio: 'ignore' })
  } catch (error) {
    // Ignoring this error, 'bw logout' is run only to prevent a login attempt
    // below on an already logged in Bitwarden client.
  }

  let item
  try {
    child_process.execSync('bw login --apikey', { env, encoding: 'utf8' })
    env.BW_SESSION = child_process.execSync('bw unlock --raw --passwordenv BW_PASSWORD', { env, encoding: 'utf8' })
    for (let i = 0; i < items.length; i++) {
      item = items[i]
      child_process.execSync( `bw edit item ${item.id} ${Buffer.from(JSON.stringify(item)).toString('base64')}`, { env, encoding: 'utf8' })
    }
    child_process.execSync('bw logout')
  } catch (error) {
    const message = `setItems: Could not set items. Current item name '${item?.name}'`
    log.error({ error, message, channel: 'operations' })
    child_process.execSync('bw logout')
    throw Error(message)
  }
}

exports.items = {}

exports.validations = {
  certificates: {},
  development: {},
  operations: {},
}

function backup({ data }) {
  const key = crypto.createHash('sha512').update(process.env.ALIAJS_VARIABLE_2).digest('hex').substring(0, 32)
  const encryptionIV = crypto.createHash('sha512').update('').digest('hex').substring(0, 16)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, encryptionIV)
  const final = `${cipher.update(data, 'utf8', 'hex')}${cipher.final('hex')}`
  fs.writeFileSync(`../.aliajs-sauce-backup-9f6e7ec1`, final)
  fs.writeFileSync(`../.aliajs-sauce-backup-9f6e7ec1-${Date.now()}`, final)
  validate()
}

function restore() {
  const data = fs.readFileSync(`../.aliajs-sauce-backup-9f6e7ec1`).toString('utf8')
  const key = crypto.createHash('sha512').update(process.env.ALIAJS_VARIABLE_2).digest('hex').substring(0, 32)
  const encryptionIV = crypto.createHash('sha512').update('').digest('hex').substring(0, 16)
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, encryptionIV)
  const final = `${decipher.update(data, 'hex', 'utf8')}${decipher.final('utf8')}`
  exports.items = JSON.parse(final)
  validate()
}

function validate() {
  for (const name in exports.validations) {
    if (exports.getNotes({ items: exports.items[name], name: 'restore_validation' }) !== process.env.RESTORE_VALIDATION) {
      throw Error(`restore: Validations failed, could not validate 'restore_validation' notes for ${name}`)
    }
  }
}

function variables() {
  const parsed = dotenv.parse(fs.readFileSync(`${__dirname}/../.env`))
  for (let key in parsed) {
    if (process.env[key] === '') {
      process.env[key] = exports.getItem({ items: exports.items.operations, name: key }).notes
    }
  }
}

try {
  // Development items
  // restore()
  // exports.items.operations.variables = JSON.parse(exports.getNotes({ items: exports.items.operations, name: 'variables' }))
  // console.log(exports.items)

  // Production items
  exports.items.operations = exports.getItems({ variables: [process.env.ALIAJS_VARIABLE_0, process.env.ALIAJS_VARIABLE_1, process.env.ALIAJS_VARIABLE_2] })
  exports.items.operations.variables = JSON.parse(exports.getNotes({ items: exports.items.operations, name: 'variables' }))
  exports.items.development = exports.getItems({ variables: exports.items.operations.variables[1] })
  exports.items.certificates = exports.getItems({ variables: exports.items.operations.variables[2] })
  backup({ data: JSON.stringify(exports.items) })
  // console.log(exports.items)

  variables()
} catch (error) {
  const message = '<!channel> items: Error exporting items'

  log.error({ error, message, syncF2f8844b: true, channel: 'operations' })
  throw Error(message)
  // Uncomment the restore() lines below only in case of a catastrophic event.
  // try {
  //   restore()
  // } catch (error) {
  //   log.error({ error, message: 'Fatal error! Could not get the sauce. Followed by a critical error: Could not restore the sauce. Process will exit in 1600 milliseconds.', channel: 'operations' })
  //   process.exit(1)
  // }
}
