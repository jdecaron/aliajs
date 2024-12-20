require('dotenv').config({ path: `${__dirname}/../.env` })

const log = require('./logger')(__filename)

const child_process = require('child_process')
const { getItem, getNotes, items, setItems } = require('./items')
const { getDomain, exec, SSH } = require('./utils')
const { domains } = require('../configurations/domains')

exports.renewCertificates = async () => {
  for (let i = 0; i < domains.length; i++) {
    const host = domains[i]
    const ssh = {
      current: SSH({ address: host.host, keyName: process.env.ALIAJS_KEY_NAME }),
    }
    try {
      await ssh.current({ command: 'sudo snap install --classic certbot' })
    } catch (error) {
      console.log(error.message)
    }

    const domain = getDomain({ domain: host.host })
    const list = host.domains.reduce((previous, current) => { return `${previous} -d ${current}` }, '')
    if (host.mode === 'dns') {
      const temp = (await ssh.current({ command: 'mktemp -d' })).replace(/\s$/, '')
      const token = getNotes({ items: items.operations, name: `DNS API token (${domain})` })
      const zoneID = getNotes({ items: items.operations, name: `DNS Zone ID (${domain})` })
      await exec({ command: `scp -q -i ~/.ssh/${process.env.ALIAJS_KEY_NAME}.pem -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null cli/certbot/authenticator.sh cli/certbot/cleanup.sh ubuntu@${host.host}:${temp}` })
      await ssh.current({ command: `chmod a+x ${temp}/*.sh` })
      await ssh.current({ command: `export CF_ZONE_ID=${zoneID}; export CF_API_KEY=${token}; sudo -E certbot certonly -v -n -m certbot@${host.host} --agree-tos --manual --preferred-challenges=dns --manual-auth-hook ${temp}/authenticator.sh --manual-cleanup-hook ${temp}/cleanup.sh --force-renewal ${list}`, secrets: [ token ] })
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
}

exports.renewCertificates()
