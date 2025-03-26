const { getItem, items } = require('../src/items')

exports.instances = [
  {
    "name": "champignonniere-production",
    "address": "35.183.159.96",
    "type": "t3a.medium",
    "additionalSecurityGroups": ["sg-014419c2799d52b95"],
    "services": [
      {
        // https://frappeframework.com/docs/user/en/bench/reference/new-site
        // https://frappeframework.com/docs/user/en/production-setup
        // https://frappeframework.com/docs/user/en/bench/guides/setup-production
        // https://frappeframework.com/docs/user/en/installation
        // https://frappeframework.com/docs/user/en/tutorial/install-and-setup-bench
        // https://frappeframework.com/docs/user/en/basics/sites#site-config
        // https://frappeframework.com/docs/user/en/bench/reference/restore
        "name": "champignonniere",
        "tier": "production",
        "type": "nginx",
        "template": "frappe",
        "domains": [
          "champignonniere-production.rotat.io",
        ],
        "locations": [],
        "setup": {
          "initial": [
            { command: "sudo apt-get update", target: "new" },
            { command: "sudo apt-get -y install git python-is-python3 python3-dev python3-pip redis-server", target: "new" },
            { command: "sudo apt-get -y install mariadb-server mariadb-client", target: "new" },
            { command: `sudo mysqladmin --user=root password ${getItem({ items: items.operations, name: 'FRAPPE_DB_ROOT_PASSWORD' }).notes}`, target: "new" },
            { command: "sudo apt-get -y install supervisor", target: "new" },
            { command: "sudo apt-get -y install python3.12-venv", target: "new" },
            { command: "npm install -g yarn", target: "new" },
            { command: "sudo ln -f -s <%= home %>/opt/node-v*/bin/yarn /usr/bin/yarn", target: "new" },
            { command: "sudo pip3 install --break-system-packages frappe-bench", target: "new" },
            { command: "cd <%= home %> && bench init frappe-bench", target: "new" },
            { command: `cd <%= home %>/frappe-bench && bench new-site --db-root-password ${getItem({ items: items.operations, name: 'FRAPPE_DB_ROOT_PASSWORD' }).notes} --admin-password ${getItem({ items: items.operations, name: 'FRAPPE_ADMIN_PASSWORD' }).notes} champignonniere-production.rotat.io`, target: "new" },
            { command: "cd <%= home %>/frappe-bench && sudo bench setup supervisor", target: "new" },
            { command: "cd <%= home %>/frappe-bench && sudo cp config/supervisor.conf /etc/supervisor/conf.d/", target: "new" },
            { command: "sudo supervisorctl reload", target: "new" },
            { command: "cd <%= home %>/frappe-bench && bench get-app erpnext", target: "new" },
            { command: "cd <%= home %>/frappe-bench && bench --site champignonniere-production.rotat.io install-app erpnext", target: "new" },
            { command: "mkdir <%= home %>/frappe-bench/sites/champignonniere-production.rotat.io/private/aliajs-backups || true", target: "current" },
            { command: "cd <%= home %>/frappe-bench && bench --site champignonniere-production.rotat.io backup --backup-path-db <%= home %>/frappe-bench/sites/champignonniere-production.rotat.io/private/aliajs-backups/database.sql.gz --compress", target: "current" },
            { command: "scp -q -i ~/.ssh/<%= aliajs_key_name %>.pem -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ubuntu@<%= server_name %>:<%= home %>/frappe-bench/sites/champignonniere-production.rotat.io/private/aliajs-backups/database.sql.gz <%= temp %>/database.sql.gz", target: "orchestrator" },
            { command: "mkdir <%= home %>/frappe-bench/sites/champignonniere-production.rotat.io/private/aliajs-backups || true", target: "new" },
            { command: "scp -q -i ~/.ssh/<%= aliajs_key_name %>.pem -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null <%= temp %>/database.sql.gz ubuntu@<%= address %>:<%= home %>/frappe-bench/sites/champignonniere-production.rotat.io/private/aliajs-backups/database.sql.gz", target: "orchestrator" },
            { command: `cd <%= home %>/frappe-bench && bench --site champignonniere-production.rotat.io restore <%= home %>/frappe-bench/sites/champignonniere-production.rotat.io/private/aliajs-backups/database.sql.gz --db-root-username root --db-root-password ${getItem({ items: items.operations, name: 'FRAPPE_DB_ROOT_PASSWORD' }).notes}`, target: "new" },
            // curl --header "Authorization: token x:x" https://champignonniere-production.rotat.io/api/resource/AliaJSTest/jati349euf
          ]
        }
      }
    ]
  },
  {
    "name": "headscale-production",
    "address": "35.182.87.59",
    "type": "t2.nano",
    "additionalSecurityGroups": ["sg-014419c2799d52b95"],
    "services": [
      {
        "name": "headscale",
        "tier": "production",
        "type": "nginx",
        "domains": [
          `${process.env.ALIAJS_DEFAULT_HEADSCALE_DOMAIN}`,
        ],
        "locations": [
          {
            "location": "/",
            "proxy_pass": "http://127.0.0.1:8080",
          },
        ],
        "setup": {
          "initial": [
            { command: "sudo apt-get install sqlite3", target: "new" },
            { command: "cd <%= home %> && curl -L -O https://github.com/juanfont/headscale/releases/download/v0.25.1/headscale_0.25.1_linux_amd64.deb", target: "new" },
            { command: "cd <%= home %> && sudo dpkg -i headscale_0.25.1_linux_amd64.deb", target: "new" },
            { command: `cd <%= home %> && sudo sqlite3 /var/lib/headscale/db.sqlite ".backup 'db.sqlite'"`, target: "current" },
            { command: "scp -q -i ~/.ssh/<%= aliajs_key_name %>.pem -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ubuntu@<%= server_name %>:<%= home %>/db.sqlite <%= temp %>/db.sqlite", target: "orchestrator" },
            { command: "scp -q -i ~/.ssh/<%= aliajs_key_name %>.pem -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null <%= temp %>/db.sqlite ubuntu@<%= address %>:<%= home %>/db.sqlite", target: "orchestrator" },
            { command: `cd <%= home %> && sudo sqlite3 /var/lib/headscale/db.sqlite ".restore 'db.sqlite'"`, target: "new" },
            { command: "sudo systemctl enable headscale", target: "new" },
            { command: "sudo systemctl start headscale", target: "new" },
          ]
        }
      },
    ]
  },
  {
    "name": "telemetry-production",
    "address": "3.97.235.183",
    "type": "t2.nano",
    "headscaleDNS": { // dns.extra_records
      "value": undefined,
      "domains": [
        "prometheus-production.rotat.io",
      ],
    },
    "services": [
      {
        // https://prometheus-production.rotat.io/graph?g0.range_input=24h&g0.stacked=0&g0.expr=100%20-%20(avg%20by(instance)%20(rate(node_cpu_seconds_total%7Bmode%3D%22idle%22%7D%5B2m%5D))%20*%20100)&g0.tab=0&g1.range_input=24h&g1.stacked=0&g1.expr=node_memory_MemAvailable_bytes%20%2F%20node_memory_MemTotal_bytes%20*%20100&g1.tab=0&g2.range_input=24h&g2.expr=sum%20by%20(instance)%20(rate(node_network_receive_bytes_total%5B2m%5D))%20%2F%201024%20%2F%201024&g2.tab=0&g3.range_input=24h&g3.expr=sum%20by%20(instance)%20(rate(node_network_transmit_bytes_total%5B2m%5D))%20%2F%201024%20%2F%201024&g3.tab=0&g4.range_input=24h&g4.expr=sum%20by%20(instance)%20(rate(node_disk_read_bytes_total%5B2m%5D))%20%2F%201024%20%2F%201024&g4.tab=0&g5.range_input=24h&g5.expr=sum%20by%20(instance)%20(rate(node_disk_written_bytes_total%5B2m%5D))%20%2F%201024%20%2F%201024&g5.tab=0&g6.range_input=24h&g6.expr=(node_filesystem_avail_bytes%20*%20100)%20%2F%20node_filesystem_size_bytes&g6.tab=0
        "name": "prometheus",
        "tier": "production",
        "type": "nginx",
        "domains": [
          "prometheus-production.rotat.io",
        ],
        "locations": [
          {
            "location": "/",
            "proxy_pass": "http://127.0.0.1:9090",
          },
        ],
        "setup": {
          "initial": [
            { command: "sudo snap install prometheus-alertmanager", target: "new" },
            { command: "sudo snap install prometheus", target: "new" },
          ],
        },
      },
    ]
  },
  {
    "name": "aliajs-production",
    "address": "15.157.29.183",
    // "imageName": "aliajs-node-18-ami",
    "type": "t2.micro",
    "additionalSecurityGroups": ["sg-014419c2799d52b95"],
    "services": [
      {
        "name": "aliajs",
        "language": "javascript",
        "tier": "production",
        "type": "express",
        "remote_repository": "https://github.com/jdecaron/aliajs.git",
        "setup": {
          "initial": [
            { command: "npm install -g @bitwarden/cli", target: "new" },
            { command: "sudo ln -f -s <%= home %>/opt/node-v*/bin/bw /usr/bin/bw", target: "new" },
            { command: "echo \"Host * \n  StrictHostKeyChecking no\n  IdentityFile ~/.ssh/<%= aliajs_key_name %>.pem\" > ~/.ssh/config", target: "new" },
            { command: "scp -q -i ~/.ssh/<%= aliajs_key_name %>.pem -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ~/.ssh/<%= aliajs_key_name %>.pem ubuntu@<%= address %>:.ssh/<%= aliajs_key_name %>.pem", target: "orchestrator" },
          ]
        }
      }
    ]
  },
]
