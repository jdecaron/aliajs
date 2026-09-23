export const instances = [
  {
    // https://frappeframework.com/docs/user/en/bench/reference/new-site
    // https://frappeframework.com/docs/user/en/production-setup
    // https://frappeframework.com/docs/user/en/bench/guides/setup-production
    // https://frappeframework.com/docs/user/en/installation
    // https://frappeframework.com/docs/user/en/tutorial/install-and-setup-bench
    // https://frappeframework.com/docs/user/en/basics/sites#site-config
    // https://frappeframework.com/docs/user/en/bench/reference/restore
    "name": "erpnext-production",
    "imageName": "aliajs-erpnext-15",
    "services": [
      {
        "name": "rotatio-gateway",
        "fallback": ["location", ["type", "cpx22"]],
        "tier": "production",
        "type": "nginx",
        "domains": [
          `${process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN}`,
        ],
        "locations": [
          {
            "location": "/",
            "redirect": `https://erpnext-production.${process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN}/`,
          },
        ]
      },
      {
        "name": "erpnext",
        "tier": "production",
        "type": "nginx",
        "template": "frappe",
        "domains": [
          `erpnext-production.${process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN}`,
        ],
        "locations": [],
        "operations": {
          "initial": [
            { command: async ({ c }) => {
              await c.ssh.new({ command: `sudo mysqladmin --user=root password ${c.items.getItem({ items: c.items.items.operations, name: 'FRAPPE_DB_ROOT_PASSWORD' }).notes}`, sauce: c.sauce  })
              await c.ssh.new({ command: `cd ${c.data.home}/frappe-bench && bench new-site --db-root-password ${c.items.getItem({ items: c.items.items.operations, name: 'FRAPPE_DB_ROOT_PASSWORD' }).notes} --admin-password ${c.items.getItem({ items: c.items.items.operations, name: 'FRAPPE_ADMIN_PASSWORD' }).notes} erpnext-production.${process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN}`, sauce: c.sauce })
            }},
            { command: "cd <%= home %>/frappe-bench && sudo bench setup supervisor", target: "new" },
            { command: "cd <%= home %>/frappe-bench && sudo cp config/supervisor.conf /etc/supervisor/conf.d/", target: "new" },
            { command: "sudo supervisorctl reload", target: "new" },
            { command: "cd <%= home %>/frappe-bench && bench get-app erpnext --branch version-15", target: "new" },
            { command: `cd <%= home %>/frappe-bench && bench --site erpnext-production.${process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN} install-app erpnext`, target: "new" },
            { command: "cd <%= home %>/frappe-bench && bench build", target: "new" },
          ],
          "backup": [
            { command: async ({ c }) => {
              await c.ssh.current({ command: `mkdir ${c.data.home}/frappe-bench/sites/erpnext-production.${process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN}/private/aliajs-backups || true` })
              await c.ssh.current({ command: `cd ${c.data.home}/frappe-bench && bench --site erpnext-production.${process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN} backup --backup-path-db ${c.data.home}/frappe-bench/sites/erpnext-production.${process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN}/private/aliajs-backups/database.sql.gz --compress` })
              await c.ssh.current({ command: `export AWS_ACCESS_KEY_ID=${process.env.ALIAJS_DEFAULT_S3_ACCESS_KEY_ID}; export AWS_SECRET_ACCESS_KEY=${process.env.ALIAJS_DEFAULT_S3_SECRET_ACCESS_KEY}; export RESTIC_PASSWORD=${process.env.ALIAJS_VARIABLE_2}; restic -r ${process.env.ALIAJS_DEFAULT_S3_URL}/restic backup --stdin --stdin-filename erpnext-production --tag erpnext-production < ${c.data.home}/frappe-bench/sites/erpnext-production.${process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN}/private/aliajs-backups/database.sql.gz`, sauce: c.sauce })
            }},
          ],
          "restore": [
            { command: `mkdir <%= home %>/frappe-bench/sites/erpnext-production.${process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN}/private/aliajs-backups || true`, target: "new" },
            { command: async ({ c }) => {
              await c.ssh.new({ command: `export AWS_ACCESS_KEY_ID=${process.env.ALIAJS_DEFAULT_S3_ACCESS_KEY_ID}; export AWS_SECRET_ACCESS_KEY=${process.env.ALIAJS_DEFAULT_S3_SECRET_ACCESS_KEY}; export RESTIC_PASSWORD=${process.env.ALIAJS_VARIABLE_2}; restic -r ${process.env.ALIAJS_DEFAULT_S3_URL}/restic dump latest erpnext-production --tag erpnext-production > ${c.data.home}/frappe-bench/sites/erpnext-production.${process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN}/private/aliajs-backups/database.sql.gz`, sauce: c.sauce })
              await c.ssh.new({ command: `cd ${c.data.home}/frappe-bench && bench --site erpnext-production.${process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN} restore ${c.data.home}/frappe-bench/sites/erpnext-production.${process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN}/private/aliajs-backups/database.sql.gz --db-root-username root --db-root-password ${c.items.getItem({ items: c.items.items.operations, name: 'FRAPPE_DB_ROOT_PASSWORD' }).notes}`, sauce: c.sauce })
            }},
          ],
        }
      }
    ]
  },
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
              await c.ssh.current({ command: `export AWS_ACCESS_KEY_ID=${process.env.ALIAJS_DEFAULT_S3_ACCESS_KEY_ID}; export AWS_SECRET_ACCESS_KEY=${process.env.ALIAJS_DEFAULT_S3_SECRET_ACCESS_KEY}; export RESTIC_PASSWORD=${process.env.ALIAJS_VARIABLE_2}; restic -r ${process.env.ALIAJS_DEFAULT_S3_URL}/restic backup --stdin --stdin-filename sauce-production-backup --tag sauce-production-backup < /vw-data/${backupFile}`, sauce: c.sauce })
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
              await c.ssh.new({ command: `export AWS_ACCESS_KEY_ID=${process.env.ALIAJS_DEFAULT_S3_ACCESS_KEY_ID}; export AWS_SECRET_ACCESS_KEY=${process.env.ALIAJS_DEFAULT_S3_SECRET_ACCESS_KEY}; export RESTIC_PASSWORD=${process.env.ALIAJS_VARIABLE_2}; restic -r ${process.env.ALIAJS_DEFAULT_S3_URL}/restic dump latest sauce-production-backup --tag sauce-production-backup > ${c.data.home}/${c.data.unique}/db.sqlite3`, sauce: c.sauce })
              await c.ssh.new({ command: `sudo cp ${c.data.home}/${c.data.unique}/db.sqlite3 /vw-data/db.sqlite3` })
              await c.ssh.new({ command: `sudo docker start vaultwarden` })
            }},
          ],
        },
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
