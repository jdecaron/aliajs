process.env.ALIAJS_BOOTSTRAP_MODE = 'bootstrap'
import './env.js'

// SAUCE TRICK

import child_process from 'child_process'
import fs from 'fs'
import os from 'os'
import { isCancel, cancel, password, select } from '@clack/prompts'
import * as cloud from './cloud/cloud.js'
import { items, setItem } from  './items.js'
import { newImage } from './new-image.js'
import * as utils from './utils.js'

// TODO WARNING!!! Radio, proceed with caution, second step, understand the risk, running on new project

// TODO SSH public key
// TODO check against other tools to see what they do to manage ssh access ... Capistrano, Pulumi,
// ? maybe ? https://claude.ai/chat/14e0ed8b-6e32-4792-b472-beffa6dc963a
// ssh-keygen -t ed25519 -C "process.env.ALIAJS_KEY_NAME" -f ~/.ssh/process.env.ALIAJS_KEY_NAME
// cat ~/.ssh/process.env.ALIAJS_KEY_NAME .pub

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

// value = await password({
//   message: `What is your ${value} API key (token)?`,
// })

// if (isCancel(value)) {
//   cancel('Operation cancelled')
//   process.exit(0)
// }
// TODO
value = process.env.TEMP_API_TOKEN // TODO

process.env[`${process.env.ALIAJS_DEFAULT_CLOUD}_API_TOKEN`] = value
setItem({ items: items.operations, name: `${process.env.ALIAJS_DEFAULT_CLOUD}_API_TOKEN`, notes: value })

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
  process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN = 'roulance.com' // TODO ask for ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN
  setItem({ items: items.operations, name: 'ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN', notes: process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN })
}

{
  process.env.ALIAJS_DEFAULT_S3_ACCESS_KEY_ID = process.env.ALIAJS_DEFAULT_S3_ACCESS_KEY_ID // TODO
  process.env.ALIAJS_DEFAULT_S3_SECRET_ACCESS_KEY = process.env.ALIAJS_DEFAULT_S3_SECRET_ACCESS_KEY // TODO
  const uniqueString = utils.getUniqueString({ characters: 'abcdefghijklmnopqrstuvwxyz0123456789', length: 3 })
  process.env.ALIAJS_DEFAULT_S3_URL = await cloud.createBucket({ name: `${process.env.APP_NAME}-${uniqueString}-bucket` })


  setItem({ items: items.operations, name: 'ALIAJS_DEFAULT_S3_ACCESS_KEY_ID', notes: process.env.ALIAJS_DEFAULT_S3_ACCESS_KEY_ID })
  setItem({ items: items.operations, name: 'ALIAJS_DEFAULT_S3_SECRET_ACCESS_KEY', notes: process.env.ALIAJS_DEFAULT_S3_SECRET_ACCESS_KEY })
  setItem({ items: items.operations, name: 'ALIAJS_DEFAULT_S3_URL', notes: process.env.ALIAJS_DEFAULT_S3_URL })
  console.log('🪣', process.env.ALIAJS_DEFAULT_S3_URL)
}

let key
{
  process.env.ALIAJS_KEY_NAME = `${(new Date()).toISOString().slice(0, 10)}-${process.env.APP_NAME}-key.pem`
  setItem({ items: items.operations, name: 'ALIAJS_KEY_NAME', notes: process.env.ALIAJS_KEY_NAME })
  const keyPath = `${os.homedir()}/.ssh/${process.env.ALIAJS_KEY_NAME}`
  child_process.execSync(`rm -f ~/.ssh/2026-*`)
  child_process.execSync(`ssh-keygen -t ed25519 -f ${keyPath} -C "${process.env.ALIAJS_KEY_NAME}" -N ""`)

  key = utils.deepFreeze({
    name: process.env.ALIAJS_KEY_NAME,
    value: fs.readFileSync(`${keyPath}.pub`).toString('utf8'),
  })
  await cloud.createKey({ key })
  setItem({ items: items.operations, name: process.env.ALIAJS_KEY_NAME, notes: fs.readFileSync(keyPath).toString('utf8') })
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
      console.log('Save these accounts informations in your personal secure information vault 🔐')
      for (let account of accounts) {
        try {
          console.log(`\nAccount: ${account.email}\nPassword: ${account.password}`)
          await newItems({ address: c.data.instance.PublicIpAddress, email: account.email, items: account.items, password: account.password, type: account.type, variables })
        } catch (error) {
          console.error(error)
        }
      }

      items.operations.variables = variables
      process.env.ALIAJS_VARIABLE_0 = variables[0][0]
      process.env.ALIAJS_VARIABLE_1 = variables[0][1]
      process.env.ALIAJS_VARIABLE_2 = variables[0][2]

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
    await initInstances({ instances: [instanceClone], replace: true })

    console.log('🏁🏁🏁🏁')
    import('util').then(util => { console.log(util.inspect(instances, { depth: Infinity })) })
    // Assigning a property on process.env will implicitly convert the value to a string.
    // This behavior is deprecated. Future versions of Node.js may throw an error when the value is not a string, number, or boolean.
    // https://nodejs.org/api/process.html#processenv
    // process.env.ALIAJS_BOOTSTRAP_MODE = undefined
    delete process.env.ALIAJS_BOOTSTRAP_MODE
    // variables
    await initInstances({ domains, instances, replace: true })
  }
}
