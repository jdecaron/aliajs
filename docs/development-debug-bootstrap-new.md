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
Temporarily add these changes to src/new.js:
```js
  await renewCertificates()
  console.log((await import('util')).inspect(items, { depth: Infinity }))
```
Run src/new.js to get the console.log results ...
Copy and save the results in a file, example cert.js
Temporarily add these changes to src/renew-certificates.js:
```js
// 
import { temp } from '.../cert.js' // TODO

export const renewCertificates = async () => {
  { // TODO delete block {}
    for (let i = 0; i < domains.length; i++) {
      const host = domains[i]
      const domain = getDomain({ domain: host.host })

      const editedItems = []
      const files = [ 'privkey.pem', 'fullchain.pem' ]
      for (let j = 0; j < files.length; j++) {
        const fileName = files[j]
        const item = getItem({ items: items.certificates, name: `${domain}/${fileName}` })
        // item.notes = await ssh.current({ command: `sudo cat /etc/letsencrypt/live/${host.host}/${fileName}`, sauce: [] })
        item.notes = temp[`${host.host}/${fileName}`]
        editedItems.push(item)
      }
      setItems({ index: 2, items: editedItems })
    }
    return
  } // TODO
}
```
