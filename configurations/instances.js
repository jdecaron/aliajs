export const instances = [
  {
    "name": "sauce-production",
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
                await c.ssh.new({ command: `sudo rm /vw-data/db.sqlite3-shm` })
              } catch (error) {}
              try {
                await c.ssh.new({ command: `sudo rm /vw-data/db.sqlite3-wal` })
              } catch (error) {}
              await c.ssh.new({ command: `export AWS_ACCESS_KEY_ID=${process.env.ALIAJS_DEFAULT_S3_ACCESS_KEY_ID}; export AWS_SECRET_ACCESS_KEY=${process.env.ALIAJS_DEFAULT_S3_SECRET_ACCESS_KEY}; export RESTIC_PASSWORD=${process.env.ALIAJS_VARIABLE_2}; restic -r ${process.env.ALIAJS_DEFAULT_S3_URL}/restic dump latest sauce-production-backup > ${c.data.home}/${c.data.unique}/db.sqlite3` })
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
            { command: "npm install -g @bitwarden/cli", target: "new" },
            { command: "sudo ln -f -s <%= home %>/opt/node-v*/bin/bw /usr/bin/bw", target: "new" },
            { command: "echo \"Host * \n  StrictHostKeyChecking no\n  IdentityFile ~/.ssh/<%= aliajs_key_name %>.pem\" > ~/.ssh/config", target: "new" },
          ],
          "restore": [
            { command: async ({ c }) => {
              const sauce =  c.items.getItem({ items: c.items.items.operations, name: c.data.aliajs_key_name }).notes
              await c.ssh.new({ command: `echo '${sauce}' > ~/.ssh/${c.data.aliajs_key_name}.pem` })
              await c.ssh.new({ command: `sudo chmod 400 ~/.ssh/${c.data.aliajs_key_name}.pem` })
            }},
          ],
        }
      },
    ]
  },
]
