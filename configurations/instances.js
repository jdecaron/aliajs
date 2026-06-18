import { getItem, items } from '../src/items.js'

export const instances = [
{
  "name": "erpnext-production",
    "services": [
      {
        "name": "rotatio-gateway",
        "tier": "production",
        "type": "nginx",
        "domains": [
          "rotat.io",
        ],
        "locations": [
          {
            "location": "/",
            "redirect": "https://erpnext-production.rotat.io/",
          },
        ]
      },
      {
        "name": "erpnext",
        "tier": "production",
        "type": "erpnext",
        "template": "frappe",
        "domains": [
          "erpnext-production.rotat.io",
        ],
        "locations": [],
        "operations": {
          "initial": [
            { command: "sudo apt-get update", target: "new" },
            { command: "sudo apt-get -y install git python-is-python3 python3-dev python3-pip redis-server pkg-config", target: "new" },
            { command: "sudo apt-get -y install mariadb-server mariadb-client libmariadb-dev", target: "new" },
            { command: `sudo mysqladmin --user=root password ${getItem({ items: items.operations, name: 'FRAPPE_DB_ROOT_PASSWORD' }).notes}`, target: "new" },
            { command: "sudo apt-get -y install supervisor", target: "new" },
            { command: "sudo apt-get -y install python3.12-venv", target: "new" },
            { command: "npm install -g yarn", target: "new" },
            { command: "sudo ln -f -s <%= home %>/opt/node-v*/bin/yarn /usr/bin/yarn", target: "new" },
            { command: "sudo pip3 install --break-system-packages frappe-bench", target: "new" },
            { command: "cd <%= home %> && bench init frappe-bench --frappe-branch version-15", target: "new" },
            { command: `cd <%= home %>/frappe-bench && bench new-site --db-root-password ${getItem({ items: items.operations, name: 'FRAPPE_DB_ROOT_PASSWORD' }).notes} --admin-password ${getItem({ items: items.operations, name: 'FRAPPE_ADMIN_PASSWORD' }).notes} erpnext-production.rotat.io`, target: "new" },
            { command: "cd <%= home %>/frappe-bench && sudo bench setup supervisor", target: "new" },
            { command: "cd <%= home %>/frappe-bench && sudo cp config/supervisor.conf /etc/supervisor/conf.d/", target: "new" },
            { command: "sudo supervisorctl reload", target: "new" },
            { command: "cd <%= home %>/frappe-bench && bench get-app erpnext --branch version-15", target: "new" },
            { command: "cd <%= home %>/frappe-bench && bench --site erpnext-production.rotat.io install-app erpnext", target: "new" },
          ],
          "backup": [
            { command: "mkdir <%= home %>/frappe-bench/sites/erpnext-production.rotat.io/private/aliajs-backups || true", target: "current" },
            { command: "cd <%= home %>/frappe-bench && bench --site erpnext-production.rotat.io backup --backup-path-db <%= home %>/frappe-bench/sites/erpnext-production.rotat.io/private/aliajs-backups/database.sql.gz --compress", target: "current" },
          ],
          "restore": [
            { command: "scp -q -i ~/.ssh/<%= aliajs_key_name %>.pem -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ubuntu@<%= server_name %>:<%= home %>/frappe-bench/sites/erpnext-production.rotat.io/private/aliajs-backups/database.sql.gz <%= temp %>/database.sql.gz", target: "orchestrator" },
            { command: "mkdir <%= home %>/frappe-bench/sites/erpnext-production.rotat.io/private/aliajs-backups || true", target: "new" },
            { command: "scp -q -i ~/.ssh/<%= aliajs_key_name %>.pem -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null <%= temp %>/database.sql.gz ubuntu@<%= address %>:<%= home %>/frappe-bench/sites/erpnext-production.rotat.io/private/aliajs-backups/database.sql.gz", target: "orchestrator" },
            { command: `cd <%= home %>/frappe-bench && bench --site erpnext-production.rotat.io restore <%= home %>/frappe-bench/sites/erpnext-production.rotat.io/private/aliajs-backups/database.sql.gz --db-root-username root --db-root-password ${getItem({ items: items.operations, name: 'FRAPPE_DB_ROOT_PASSWORD' }).notes}`, target: "new" },
            // curl --header "Authorization: token x:x" https://erpnext-production.rotat.io/api/resource/AliaJSTest/jati349euf
          ],
        }
      }
    ]
  },
  {
    "name": "aliajs-production",
    "services": [
      {
        "name": "sauce",
        "tier": "production",
        "type": "nginx",
        "domains": [
          "sauce.rotat.io",
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
            { command: "sudo docker run  --detach --name vaultwarden --env DOMAIN=\"https://sauce-production.rotat.io\" --env LOGIN_RATELIMIT_MAX_BURST=20 --volume /vw-data/:/data/ --restart unless-stopped --publish 127.0.0.1:8000:80 vaultwarden/server:latest", target: "new" },
          ],
          "backup": [
            { command: async ({ c }) => {
              await c.ssh.current({ command: `sudo docker exec vaultwarden /vaultwarden backup` })
              const backupFile = (await c.ssh.current({ command: `ls -t /vw-data/ | head -n1` })).replace(/\s$/, '')
              await c.ssh.current({ command: `export AWS_ACCESS_KEY_ID=${process.env.ALIAJS_DEFAULT_S3_ACCESS_KEY_ID}; export AWS_SECRET_ACCESS_KEY=${process.env.ALIAJS_DEFAULT_S3_SECRET_ACCESS_KEY}; export RESTIC_PASSWORD=${process.env.ALIAJS_VARIABLE_2}; restic -r ${process.env.ALIAJS_DEFAULT_S3_URL}/restic backup --stdin --stdin-filename sauce-production-backup < /vw-data/${backupFile}` })
            }},
          ],
          "restore": [
            { command: async ({ c }) => {
              await c.ssh.new({ command: `sudo docker stop vaultwarden` })
              try {
                await c.ssh.new({ command: `sudo rm /vw-data/db.sqlite3-shm ` })
              } catch (error) {}
              try {
                await c.ssh.new({ command: `sudo rm /vw-data/db.sqlite3-wal ` })
              } catch (error) {}
              await c.ssh.new({ command: `export AWS_ACCESS_KEY_ID=${process.env.ALIAJS_DEFAULT_S3_ACCESS_KEY_ID}; export AWS_SECRET_ACCESS_KEY=${process.env.ALIAJS_DEFAULT_S3_SECRET_ACCESS_KEY}; export RESTIC_PASSWORD=${process.env.ALIAJS_VARIABLE_2}; restic -r ${process.env.ALIAJS_DEFAULT_S3_URL}/restic dump latest sauce-production-backup > ${c.data.home}/${c.data.unique}/db.sqlite3` })
              await c.ssh.new({ command: `sudo cp ${c.data.home}/${c.data.unique}/db.sqlite3 /vw-data/db.sqlite3` })
              await c.ssh.new({ command: `sudo docker start vaultwarden` })
            }},
          ],
        },
      },
      {
        "name": "aliajs",
        "tier": "production",
        "language": "javascript",
        "type": "nodejs",
        "remote_repository": "https://github.com/jdecaron/aliajs.git",
        "operations": {
          "initial": [
            { command: "npm install -g @bitwarden/cli", target: "new" },
            { command: "sudo ln -f -s <%= home %>/opt/node-v*/bin/bw /usr/bin/bw", target: "new" },
            { command: "echo \"Host * \n  StrictHostKeyChecking no\n  IdentityFile ~/.ssh/<%= aliajs_key_name %>.pem\" > ~/.ssh/config", target: "new" },
          ],
          "restore": [
            { command: async ({ c }) => {
              const sauce =  getItem({ items: items.operations, name: c.data.aliajs_key_name }).notes
              await c.ssh.new({ command: `echo '${sauce}' > ~/.ssh/${c.data.aliajs_key_name}.pem` })
              await c.ssh.new({ command: `sudo chmod 400 ~/.ssh/${c.data.aliajs_key_name}.pem` })
            }},
          ],
        }
      }
    ]
  },
]
