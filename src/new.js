// process.env.ALIAJS_BOOTSTRAP_MODE = 'bootstrap'
// import './bootstrap.js' is preferred
// because code here is run after imports
import './bootstrap.js'
import './env.js'

import child_process from 'child_process'
import fs from 'fs'
import os from 'os'
import { isCancel, cancel, password, select, text } from '@clack/prompts'
import * as cloud from './cloud/cloud.js'
import { items, setItem } from  './items.js'
import { newImage } from './new-image.js'
import * as utils from './utils.js'

// TODO WARNING!!! Radio, proceed with caution, second step, understand the risk, running on new project

const deployed = []
const notes = [
  `\n\n$AliaJS new setup complete! ✅`,
  ('\n\nSave these informations in your personal secure information vault 🔐'),
]
const uniqueString = utils.getUniqueString({ characters: 'abcdefghijklmnopqrstuvwxyz0123456789', length: 4 })

let value = await select({
  message: 'Set your default cloud provider. (only hetzner for now)',
  options: [
    { value: 'HETZNER', label: 'Hetzner' },
  ],
})

if (isCancel(value)) {
    cancel('Operation cancelled')
    process.exit(0)
}

process.env.ALIAJS_DEFAULT_CLOUD = value
setItem({ items: items.operations, name: 'ALIAJS_DEFAULT_CLOUD', notes: value })

value = await password({
  message: `What is your ${value} API key (token)?`,
})

if (isCancel(value)) {
  cancel('Operation cancelled')
  process.exit(0)
}

process.env[`${process.env.ALIAJS_DEFAULT_CLOUD}_API_TOKEN`] = value
setItem({ items: items.operations, name: `${process.env.ALIAJS_DEFAULT_CLOUD}_API_TOKEN`, notes: value })

notes.push(`\nCloud ☁️`)
notes.push(`\n${process.env.ALIAJS_DEFAULT_CLOUD}_API_TOKEN: ${value}`)

// Leaving low hanging fruits for the community 🫐
{
  value = await select({
    message: 'Set your default cloud location.',
    options: [
      { value: 'fsn1', label: 'Falkenstein' },
      { value: 'nbg1', label: 'Nuremberg' },
      { value: 'hel1', label: 'Helsinki' },
      { value: 'ash', label: 'Ashburn' },
      { value: 'hil', label: 'Hillsboro' },
      { value: 'sin', label: 'Singapore' },
    ],
  })

  if (isCancel(value)) {
    cancel('Operation cancelled')
  }

  process.env.ALIAJS_DEFAULT_LOCATION = value
  setItem({ items: items.operations, name: 'ALIAJS_DEFAULT_LOCATION', notes: value })
}

{
  // Leaving low hanging fruits for the community 🍑
  value = await select({
    message: 'Set your default cloud machine type.',
    options: [
      { value: 'cx23', label: 'CX23, 2VCPUS, 4GB' },
    ],
  })

  if (isCancel(value)) {
    cancel('Operation cancelled')
    process.exit(0)
  }

  process.env.ALIAJS_DEFAULT_INSTANCE_TYPE = value
  setItem({ items: items.operations, name: 'ALIAJS_DEFAULT_INSTANCE_TYPE', notes: value })
}

{
  value = await text({
    message: `What is your domain name? Example: example.com`,
  })

  if (isCancel(value)) {
    cancel('Operation cancelled')
    process.exit(0)
  }

  process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN = value
  setItem({ items: items.operations, name: 'ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN', notes: value })
}

{
  // Manual cleanup (development):
  // brew install pgsty/infra/mcli
  // mcli alias set hetzner https://<region>.your-objectstorage.com ACCESS_KEY SECRET_KEY
  // mcli rb --force hetzner/your-bucket-name

  {
    value = await password({
      message: `What is your S3 access key?`,
    })

    if (isCancel(value)) {
      cancel('Operation cancelled')
      process.exit(0)
    }

    process.env.ALIAJS_DEFAULT_S3_ACCESS_KEY_ID = value
    setItem({ items: items.operations, name: 'ALIAJS_DEFAULT_S3_ACCESS_KEY_ID', notes: value })

    notes.push(`\nALIAJS_DEFAULT_S3_ACCESS_KEY_ID: ${value}`)
  }

  {
    value = await password({
      message: `What is your S3 secret key?`,
    })

    if (isCancel(value)) {
      cancel('Operation cancelled')
      process.exit(0)
    }

    process.env.ALIAJS_DEFAULT_S3_SECRET_ACCESS_KEY = value
    setItem({ items: items.operations, name: 'ALIAJS_DEFAULT_S3_SECRET_ACCESS_KEY', notes: value })

    notes.push(`\nALIAJS_DEFAULT_S3_SECRET_ACCESS_KEY: ${value}`)
  }

  process.env.ALIAJS_DEFAULT_S3_URL = await cloud.createBucket({ name: `${process.env.APP_NAME}-bucket-${uniqueString}` })

  setItem({ items: items.operations, name: 'ALIAJS_DEFAULT_S3_ACCESS_KEY_ID', notes: process.env.ALIAJS_DEFAULT_S3_ACCESS_KEY_ID })
  setItem({ items: items.operations, name: 'ALIAJS_DEFAULT_S3_SECRET_ACCESS_KEY', notes: process.env.ALIAJS_DEFAULT_S3_SECRET_ACCESS_KEY })
  setItem({ items: items.operations, name: 'ALIAJS_DEFAULT_S3_URL', notes: process.env.ALIAJS_DEFAULT_S3_URL })
}

let key
{
  process.env.ALIAJS_KEY_NAME = `${(new Date()).toISOString().slice(0, 10)}-${process.env.APP_NAME}-${uniqueString}-key.pem`
  setItem({ items: items.operations, name: 'ALIAJS_KEY_NAME', notes: process.env.ALIAJS_KEY_NAME })
  const keyPath = `${os.homedir()}/.ssh/${process.env.ALIAJS_KEY_NAME}`
  child_process.execSync(`ssh-keygen -t ed25519 -f ${keyPath} -C "${process.env.ALIAJS_KEY_NAME}" -N ""`)

  key = utils.deepFreeze({
    name: process.env.ALIAJS_KEY_NAME,
    value: fs.readFileSync(`${keyPath}.pub`).toString('utf8'),
  })
  await cloud.createKey({ key })
  value = fs.readFileSync(keyPath).toString('utf8')
  setItem({ items: items.operations, name: process.env.ALIAJS_KEY_NAME, notes: value })

  notes.push(`\n\nssh-keygen ${process.env.ALIAJS_KEY_NAME} 🔑\n`)
  notes.push(value)
}

await newImage()

{
  await cloud.upsertDNSZone({ name: process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN })
}

{
  process.env.RESTORE_VALIDATION = 'f659c85a'
  setItem({ items: items.operations, name: 'restore_validation', notes: 'f659c85a' })
  setItem({ items: items.development, name: 'restore_validation', notes: 'f659c85a' })
  setItem({ items: items.certificates, name: 'restore_validation', notes: 'f659c85a' })

  // Bootstrap environment variables for application instances
  process.env.ALIAJS_AUTHORIZATION = utils.getUniqueString({ length: 32 })
  setItem({ items: items.operations, name: 'ALIAJS_AUTHORIZATION', notes: process.env.ALIAJS_AUTHORIZATION })

  notes.push(`\nALIAJS_AUTHORIZATION must be defined in your shell environment, see README.md.`)
  notes.push(`\nALIAJS_AUTHORIZATION: ${process.env.ALIAJS_AUTHORIZATION}`)
}

const { domains } = await utils.lazyImport({
  specifier: '../configurations/domains.js',
  baseURL: import.meta.url,
})

{
  for (const domain of domains) {
    const files = [ 'privkey.pem', 'fullchain.pem' ]
    for (let j = 0; j < files.length; j++) {
      const fileName = files[j]
      setItem({ items: items.certificates, name: `${domain.host}/${fileName}`, notes: '' })
    }
  }

  const { renewCertificates } = await utils.lazyImport({
    specifier: './renew-certificates.js',
    baseURL: import.meta.url,
  })
  await renewCertificates()
}

{
  // TODO parse instances for c.items.getItem then set them according to their
  // target c.items.items... let's do this with some meta programming (ideal)
  // hardcoded for now
  process.env.FRAPPE_DB_ROOT_PASSWORD = utils.getUniqueString({ length: 16 })
  process.env.FRAPPE_ADMIN_PASSWORD = utils.getUniqueString({ length: 16 })
  setItem({ items: items.operations, name: 'FRAPPE_DB_ROOT_PASSWORD', notes: process.env.FRAPPE_DB_ROOT_PASSWORD })
  setItem({ items: items.operations, name: 'FRAPPE_ADMIN_PASSWORD', notes: process.env.FRAPPE_ADMIN_PASSWORD })
  // TODO push to an array to show at the end of the setup process
  console.log({ name: 'FRAPPE_DB_ROOT_PASSWORD', notes: process.env.FRAPPE_DB_ROOT_PASSWORD })
  console.log({ name: 'FRAPPE_ADMIN_PASSWORD', notes: process.env.FRAPPE_ADMIN_PASSWORD  })
}

{
  const { instances } = await utils.lazyImport({
    specifier: '../configurations/instances.js',
    baseURL: import.meta.url,
  })
  const instance = utils.instance({ instances, instance_name: 'sauce-production' })
  const instanceClone = utils.cloneInstance({ instance })

  instanceClone.services[0].operations.backup = []

  instanceClone.services[0].operations.restore = [
    { command: async ({ c }) => {
      const { newItems } = await utils.lazyImport({
        specifier: './puppeteer/items.js',
        baseURL: import.meta.url,
      })

      const operationsPassword = utils.getUniqueString({ length: 16 })
      const developmentPassword = utils.getUniqueString({ length: 16 })
      const certificatesPassword = utils.getUniqueString({ length: 16 })
      const variables = []
      const accounts = [
        { email: `sauce-certificates@${process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN}`, items: items.certificates, password: certificatesPassword },
        { email: `sauce-development@${process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN}`, items: items.development, password: developmentPassword },
        { email: `sauce-operations@${process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN}`, items: items.operations, password: operationsPassword, type: 'operations' },
      ]

      await c.ssh.new({ command: 'sudo nginx -t' })
      await c.ssh.new({ command: 'sudo service nginx reload' })
      notes.push('\n\nVaultwarden Accounts 🔐')
      for (let account of accounts) {
        try {
          notes.push(`\n\nAccount: ${account.email}\nPassword: ${account.password}`)
          await newItems({ address: c.data.instance.PublicIpAddress, email: account.email, items: account.items, password: account.password, type: account.type, variables })
        } catch (error) {
          console.error(error)
        }
      }

      items.operations.variables = variables
      process.env.ALIAJS_VARIABLE_0 = variables[0][0]
      process.env.ALIAJS_VARIABLE_1 = variables[0][1]
      process.env.ALIAJS_VARIABLE_2 = variables[0][2]

      notes.push(`\n\nRESTIC_PASSWORD: ${process.env.ALIAJS_VARIABLE_2}`)

      await c.ssh.new({ command: `sudo docker exec vaultwarden /vaultwarden backup` })
      const backupFile = (await c.ssh.new({ command: `ls -t /vw-data/ | head -n1` })).replace(/\s$/, '')
      await c.ssh.new({ command: `export AWS_ACCESS_KEY_ID=${process.env.ALIAJS_DEFAULT_S3_ACCESS_KEY_ID}; export AWS_SECRET_ACCESS_KEY=${process.env.ALIAJS_DEFAULT_S3_SECRET_ACCESS_KEY}; export RESTIC_PASSWORD=${process.env.ALIAJS_VARIABLE_2}; restic -r ${process.env.ALIAJS_DEFAULT_S3_URL}/restic init`, sauce: c.sauce })
      await c.ssh.new({ command: `export AWS_ACCESS_KEY_ID=${process.env.ALIAJS_DEFAULT_S3_ACCESS_KEY_ID}; export AWS_SECRET_ACCESS_KEY=${process.env.ALIAJS_DEFAULT_S3_SECRET_ACCESS_KEY}; export RESTIC_PASSWORD=${process.env.ALIAJS_VARIABLE_2}; restic -r ${process.env.ALIAJS_DEFAULT_S3_URL}/restic backup --stdin --stdin-filename sauce-production-backup --tag sauce-production-backup < /vw-data/${backupFile}`, sauce: c.sauce })
    }},
  ]

  {
    const { initInstances } = await utils.lazyImport({
      specifier: './new-instance.js',
      baseURL: import.meta.url,
    })
    await initInstances({ deployed, instances: [instanceClone], replace: true })

    // Assigning a property on process.env will implicitly convert the value to a string.
    // This behavior is deprecated. Future versions of Node.js may throw an error when the value is not a string, number, or boolean.
    // https://nodejs.org/api/process.html#processenv
    // process.env.ALIAJS_BOOTSTRAP_MODE = undefined
    delete process.env.ALIAJS_BOOTSTRAP_MODE
    const filteredInstances = instances.filter((instance) => { return instance.name !== 'sauce-production' }) // sauce-production is already up and running from the code block above
    await initInstances({ deployed, domains, flags: { exclude: [ 'backup', 'restore' ], target: [] }, instances: filteredInstances, replace: true })
  }
}

{
  for (const note of notes) {
    process.stdout.write(note)
  }

  console.log('\n\nDeployed services:')
  for (const service of deployed) {
    console.log(service)
  }
}
