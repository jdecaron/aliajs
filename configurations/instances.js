export const instances = [
  {
    "name": "sauce-production",
    "fallback": ["location", ["type", "cpx22"]],
    "location": "hel1",
    "type": "cx23",
    "services": [
      {
        "name": "sauce",
        "tier": "production",
        "type": "nginx",
        "domains": [
          `sauce.${process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN}`,
        ],
        "locations": [
          {
            "location": "/",
            "proxy_pass": "http://127.0.0.1:8000",
          },
        ],
        "operations": {
          "initial": [
            { command: "sudo apt-get -y install restic", target: "new" },
            { command: "sudo apt-get -y install docker-compose", target: "new" },
            { command: "sudo docker pull vaultwarden/server:latest", target: "new" },
            { command: `sudo docker run  --detach --name vaultwarden --env DOMAIN="https://sauce-production.${process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN}" --env LOGIN_RATELIMIT_MAX_BURST=40 --volume /vw-data/:/data/ --restart unless-stopped --publish 127.0.0.1:8000:80 vaultwarden/server:latest`, target: "new" },
          ],
          "backup": [
            { command: async ({ c }) => {
              await c.ssh.current({ command: `sudo docker exec vaultwarden /vaultwarden backup` })
              const backupFile = (await c.ssh.current({ command: `ls -t /vw-data/ | head -n1` })).replace(/\s$/, '')
              await c.ssh.current({ command: `export AWS_ACCESS_KEY_ID=${process.env.ALIAJS_DEFAULT_S3_ACCESS_KEY_ID}; export AWS_SECRET_ACCESS_KEY=${process.env.ALIAJS_DEFAULT_S3_SECRET_ACCESS_KEY}; export RESTIC_PASSWORD=${process.env.ALIAJS_VARIABLE_2}; restic -r ${process.env.ALIAJS_DEFAULT_S3_URL}/restic backup --stdin --stdin-filename ${c.data.service.name}-${c.data.service.tier}-backup --tag ${c.data.service.name}-${c.data.service.tier}-backup < /vw-data/${backupFile}`, sauce: c.sauce })
            }},
          ],
          "restore": [
            { command: async ({ c }) => {
              await c.ssh.new({ command: `sudo docker stop vaultwarden` })
              try {
                await c.ssh.new({ command: `sudo rm /vw-data/db.sqlite3-shm` })
              } catch (error) {}
              try {
                await c.ssh.new({ command: `sudo rm /vw-data/db.sqlite3-wal` })
              } catch (error) {}
              await c.ssh.new({ command: `export AWS_ACCESS_KEY_ID=${process.env.ALIAJS_DEFAULT_S3_ACCESS_KEY_ID}; export AWS_SECRET_ACCESS_KEY=${process.env.ALIAJS_DEFAULT_S3_SECRET_ACCESS_KEY}; export RESTIC_PASSWORD=${process.env.ALIAJS_VARIABLE_2}; restic -r ${process.env.ALIAJS_DEFAULT_S3_URL}/restic dump latest ${c.data.service.name}-${c.data.service.tier}-backup --tag ${c.data.service.name}-${c.data.service.tier}-backup > ${c.data.home}/${c.data.unique}/db.sqlite3`, sauce: c.sauce })
              await c.ssh.new({ command: `sudo cp ${c.data.home}/${c.data.unique}/db.sqlite3 /vw-data/db.sqlite3` })
              await c.ssh.new({ command: `sudo docker start vaultwarden` })
            }},
          ],
        },
      },
    ]
  },
  {
    "name": "n8n-production",
    "fallback": ["location", ["type", "cpx22"]],
    "location": "hel1",
    "type": "cx23",
    "services": [
      {
        "name": "n8n-docker",
        "tier": "production",
        "type": "nginx",
        "domains": [
          `n8n.${process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN}`,
        ],
        "locations": [
          {
            "location": "/",
            "proxy_pass": "http://127.0.0.1:5678",
          },
        ],
        "operations": {
          "initial": [
            { command: "sudo apt-get -y install docker-compose", target: "new" },
            { command: "mkdir <%= home %>/n8n", target: "new" },
            { command: async ({ c }) => {
              const dockerComposeYML = await c.eta.renderAsync('n8n/docker-compose.yml', { restore: false, ...c.data })
              await c.ssh.new({ command: `echo '${dockerComposeYML}' > ${c.data.home}/n8n/docker-compose.yml` })
            }},
            { command: "cd <%= home %>/n8n && sudo docker-compose up -d", target: "new" },
          ],
          "backup": [
            { command: async ({ c }) => {
              await c.ssh.current({ command: `sudo docker exec n8n node -e "import { DatabaseSync, backup } from 'node:sqlite'; const db=new DatabaseSync('/home/node/.n8n/database.sqlite', { readOnly:true }); await backup(db, 'database-backup.sqlite');"`, sauce: c.sauce }) // sqlite3 is not installed on the n8n default docker image, native sqlite module introduced in NodeJS v22.5.0 is a good solution to run the database backup operation
              await c.ssh.current({ command: `sudo docker cp n8n:/home/node/database-backup.sqlite ${c.data.home}/n8n/database-backup.sqlite`, sauce: c.sauce })
              await c.ssh.current({ command: `sudo docker cp n8n:/home/node/.n8n/config ${c.data.home}/n8n/config`, sauce: c.sauce })
              await c.ssh.current({ command: `sudo chown $USER:$USER ${c.data.home}/n8n/config ${c.data.home}/n8n/database-backup.sqlite`, sauce: c.sauce })
              await c.ssh.current({ command: `export AWS_ACCESS_KEY_ID=${process.env.ALIAJS_DEFAULT_S3_ACCESS_KEY_ID}; export AWS_SECRET_ACCESS_KEY=${process.env.ALIAJS_DEFAULT_S3_SECRET_ACCESS_KEY}; export RESTIC_PASSWORD=${process.env.ALIAJS_VARIABLE_2}; restic -r ${process.env.ALIAJS_DEFAULT_S3_URL}/restic backup --stdin --stdin-filename n8n-production-config-backup --tag n8n-production-config-backup < ${c.data.home}/n8n/config`, sauce: c.sauce })
              await c.ssh.current({ command: `export AWS_ACCESS_KEY_ID=${process.env.ALIAJS_DEFAULT_S3_ACCESS_KEY_ID}; export AWS_SECRET_ACCESS_KEY=${process.env.ALIAJS_DEFAULT_S3_SECRET_ACCESS_KEY}; export RESTIC_PASSWORD=${process.env.ALIAJS_VARIABLE_2}; restic -r ${process.env.ALIAJS_DEFAULT_S3_URL}/restic backup --stdin --stdin-filename n8n-production-database-backup --tag n8n-production-database-backup < ${c.data.home}/n8n/database-backup.sqlite`, sauce: c.sauce })
            }},
          ],
          "restore": [
            { command: async ({ c }) => {
              await c.ssh.new({ command: `cd ${c.data.home}/n8n && sudo docker-compose down -v` })
              const dockerComposeYML = await c.eta.renderAsync('n8n/docker-compose.yml', { restore: true, ...c.data })
              await c.ssh.new({ command: `echo '${dockerComposeYML}' > ${c.data.home}/n8n/docker-compose.yml` })
              await c.ssh.new({ command: `export AWS_ACCESS_KEY_ID=${process.env.ALIAJS_DEFAULT_S3_ACCESS_KEY_ID}; export AWS_SECRET_ACCESS_KEY=${process.env.ALIAJS_DEFAULT_S3_SECRET_ACCESS_KEY}; export RESTIC_PASSWORD=${process.env.ALIAJS_VARIABLE_2}; restic -r ${process.env.ALIAJS_DEFAULT_S3_URL}/restic dump latest n8n-production-config-backup --tag n8n-production-config-backup > ${c.data.home}/n8n/config`, sauce: c.sauce })
              await c.ssh.new({ command: `export AWS_ACCESS_KEY_ID=${process.env.ALIAJS_DEFAULT_S3_ACCESS_KEY_ID}; export AWS_SECRET_ACCESS_KEY=${process.env.ALIAJS_DEFAULT_S3_SECRET_ACCESS_KEY}; export RESTIC_PASSWORD=${process.env.ALIAJS_VARIABLE_2}; restic -r ${process.env.ALIAJS_DEFAULT_S3_URL}/restic dump latest n8n-production-database-backup --tag n8n-production-database-backup > ${c.data.home}/n8n/database.sqlite`, sauce: c.sauce })
              await c.ssh.new({ command: `cd ${c.data.home}/n8n && sudo docker-compose up -d` })
            }},
          ],
        }
      },
    ]
  },
  {
    "name": "aliajs-production",
    "services": [
      {
        "name": "aliajs",
        "tier": "production",
        "language": "javascript",
        "type": "nodejs",
        "remote_repository": "https://github.com/jdecaron/aliajs.git",
        "operations": {
          "initial": [
            { command: "npm install -g @bitwarden/cli@2026.6", target: "new" }, // https://github.com/dani-garcia/vaultwarden/discussions/7615#discussioncomment-18140443
            { command: "sudo ln -f -s <%= home %>/opt/node-v*/bin/bw /usr/bin/bw", target: "new" },
            { command: `bw config server https://sauce-production.${process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN}`, target: "new" },
            { command: "echo \"Host * \n  StrictHostKeyChecking no\n  IdentityFile ~/.ssh/<%= aliajs_key_name %>\" > ~/.ssh/config", target: "new" },
          ],
          "restore": [
            { command: async ({ c }) => {
              const sauce =  c.items.getItem({ items: c.items.items.operations, name: c.data.aliajs_key_name }).notes
              await c.ssh.new({ command: `echo '${sauce}' > ~/.ssh/${c.data.aliajs_key_name}` })
              await c.ssh.new({ command: `sudo chmod 400 ~/.ssh/${c.data.aliajs_key_name}` })
            }},
          ],
        }
      },
    ]
  },
]
