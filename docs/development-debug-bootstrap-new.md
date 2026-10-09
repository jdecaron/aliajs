# How to develop, debug src/new.js

## Iterate faster, skip:
ssh-keygen
```js
{
  // process.env.ALIAJS_KEY_NAME = `${(new Date()).toISOString().slice(0, 10)}-${process.env.APP_NAME}-${uniqueString}-key.pem`
  process.env.ALIAJS_KEY_NAME = `2026-09-22-aliajs-m597-key.pem`
  setItem({ items: items.operations, name: 'ALIAJS_KEY_NAME', notes: process.env.ALIAJS_KEY_NAME })
  const keyPath = `${os.homedir()}/.ssh/${process.env.ALIAJS_KEY_NAME}`
  // child_process.execSync(`ssh-keygen -t ed25519 -f ${keyPath} -C "${process.env.ALIAJS_KEY_NAME}" -N ""`)

  key = utils.deepFreeze({
    name: process.env.ALIAJS_KEY_NAME,
    value: fs.readFileSync(`${keyPath}.pub`).toString('utf8'),
  })
  // await cloud.createKey({ key })
  setItem({ items: items.operations, name: process.env.ALIAJS_KEY_NAME, notes: fs.readFileSync(keyPath).toString('utf8') })

  notes.push(`\n\nssh-keygen ${process.env.ALIAJS_KEY_NAME} 🔑\n`)
  notes.push(value)
}
```

newImage() & upsertDNSZone()
```js
// await newImage()

// {
//   await cloud.upsertDNSZone({ name: process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN })
// }
```

## renewCertificates()
Save your certificates locally from your vault under ...example/example... comment out renewCertificates(), replace empty setItem with local files:
```js src/new.js
{
  for (const domain of domains) {
    const files = [ 'privkey.pem', 'fullchain.pem' ]
    for (let j = 0; j < files.length; j++) {
      const fileName = files[j]
      // setItem({ items: items.certificates, name: `${domain.host}/${fileName}`, notes: '' }) // TODO
      setItem({ items: items.certificates, name: `${domain.host}/${fileName}`, notes: fs.readFileSync(`.../${domain.host}/${fileName}`).toString('utf8') }) // TODO
    }
  }

  // const { renewCertificates } = await utils.lazyImport({
  //   specifier: './renew-certificates.js',
  //   baseURL: import.meta.url,
  // })
  // await renewCertificates()
}
```
