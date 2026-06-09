import './env.js'

import child_process from 'child_process'
import { fileURLToPath } from 'url'
import * as cloud from './cloud/cloud.js'
import { getItem, getNotes, items, setItems } from './items.js'
import { getCloudAPItoken, getDomain, exec, SSH } from './utils.js'
import { domains } from '../configurations/domains.js'
import logger from './logger.js'

const log = logger(fileURLToPath(import.meta.url))

export const renewCertificates = async () => {
  const { Reservations } = await cloud.newInstance({
    imageName: process.env.ALIAJS_DEFAULT_IMAGE_NAME,
    keyName: process.env.ALIAJS_KEY_NAME,
    name: 'aliajs-renew-certificates',
    type: process.env.ALIAJS_DEFAULT_TYPE,
  })
  const instance = Reservations[0].Instances[0]

  const ssh = {
    current: SSH({ address: instance.PublicIpAddress, keyName: process.env.ALIAJS_KEY_NAME }),
  }

  for (let i = 0; i < domains.length; i++) {
    const host = domains[i]
    try {
      await ssh.current({ command: 'sudo snap install --classic certbot' })
    } catch (error) {
      console.log(error.message)
    }

    const domain = getDomain({ domain: host.host })
    const list = host.domains.reduce((previous, current) => { return `${previous} -d ${current}` }, '')
    if (host.mode === 'dns') {
      const temp = (await ssh.current({ command: 'mktemp -d' })).replace(/\s$/, '')
      const token = getCloudAPItoken({ cloud: host.cloud })
      const zone = domain
      await exec({ command: `scp -q -i ~/.ssh/${process.env.ALIAJS_KEY_NAME}.pem -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null cli/certbot/${host.cloud}/authenticator.sh cli/certbot/${host.cloud}/cleanup.sh ubuntu@${instance.PublicIpAddress}:${temp}` })
      await ssh.current({ command: `chmod a+x ${temp}/*.sh` })
      await ssh.current({ command: `export ZONE=${zone}; export API_KEY=${token}; sudo -E certbot certonly -v -n -m certbot@${host.host} --agree-tos --manual --preferred-challenges=dns --manual-auth-hook ${temp}/authenticator.sh --manual-cleanup-hook ${temp}/cleanup.sh --force-renewal ${list}`, secrets: [ token ] })
    } else {
      await ssh.current({ command: `sudo certbot certonly -n -m certbot@${host.host} --agree-tos --nginx --force-renewal ${list}`, secrets: [] })
    }
    const editedItems = []
    const files = [ 'privkey.pem', 'fullchain.pem' ]
    for (let j = 0; j < files.length; j++) {
      const fileName = files[j]
      const item = getItem({ items: items.certificates, name: `${domain}/${fileName}` })
      item.notes = await ssh.current({ command: `sudo cat /etc/letsencrypt/live/${host.host}/${fileName}`, secrets: [] })
      editedItems.push(item)
    }
    setItems({ index: 2, items: editedItems })
  }

  await cloud.deleteInstance({ instance })
}

renewCertificates()
