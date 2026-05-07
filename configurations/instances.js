const { getItem, items } = require('../src/items')

exports.instances = [
{
  "name": "erpnext-production",
    "address": "5.161.19.205",
    "type": "t3a.small",
    "additionalSecurityGroups": ["sg-014419c2799d52b95"],
    "services": [
      {
        "name": "bainultra-gateway",
        "tier": "production",
        "type": "nginx",
        "domains": [
          "bainultra.dev",
        ],
        "locations": [
          {
            "location": "/",
            "redirect": "https://github.com/BainUltra",
          },
        ]
      },
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
        "setup": {
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
            // { command: "mkdir <%= home %>/frappe-bench/sites/erpnext-production.rotat.io/private/aliajs-backups || true", target: "current" },
            // { command: "cd <%= home %>/frappe-bench && bench --site erpnext-production.rotat.io backup --backup-path-db <%= home %>/frappe-bench/sites/erpnext-production.rotat.io/private/aliajs-backups/database.sql.gz --compress", target: "current" },
            // { command: "scp -q -i ~/.ssh/<%= aliajs_key_name %>.pem -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ubuntu@<%= server_name %>:<%= home %>/frappe-bench/sites/erpnext-production.rotat.io/private/aliajs-backups/database.sql.gz <%= temp %>/database.sql.gz", target: "orchestrator" },
            // { command: "mkdir <%= home %>/frappe-bench/sites/erpnext-production.rotat.io/private/aliajs-backups || true", target: "new" },
            // { command: "scp -q -i ~/.ssh/<%= aliajs_key_name %>.pem -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null <%= temp %>/database.sql.gz ubuntu@<%= address %>:<%= home %>/frappe-bench/sites/erpnext-production.rotat.io/private/aliajs-backups/database.sql.gz", target: "orchestrator" },
            // { command: `cd <%= home %>/frappe-bench && bench --site erpnext-production.rotat.io restore <%= home %>/frappe-bench/sites/erpnext-production.rotat.io/private/aliajs-backups/database.sql.gz --db-root-username root --db-root-password ${getItem({ items: items.operations, name: 'FRAPPE_DB_ROOT_PASSWORD' }).notes}`, target: "new" },
            // curl --header "Authorization: token x:x" https://erpnext-production.rotat.io/api/resource/AliaJSTest/jati349euf
          ]
        }
      }
    ]
  },
  {
    "name": "n8n-production",
    "address": "15.156.180.255",
    "type": "t3a.small",
    "services": [
      {
        "name": "n8n-docker",
        "tier": "production",
        "language": "javascript",
        "type": "nodejs",
        "remote_repository": "https://github.com/jdecaron/bainultra-n8n.git",
        "setup": {
          "initial": [
            { command: "sudo apt-get -y install redis", target: "new" },
            { command: "sudo apt-get -y install webdis", target: "new" },
            { command: "cd <%= home %>/<%= unique_service_name %> && redis-cli -x SET products < data/products.json", target: "new" },
            { command: "cd <%= home %>/<%= unique_service_name %> && redis-cli -x SET options < data/options.json", target: "new" },
            { command: "sudo apt-get -y install docker-compose", target: "new" },
            { command: "ln -s -f <%= home %>/<%= unique_service_name %> <%= home %>/n8n", target: "new" },
            { command: "sudo docker cp n8n:/home/node/.n8n/database.sqlite <%= home %>/database.sqlite", target: "current" },
            { command: "sudo docker cp n8n:/home/node/.n8n/config <%= home %>/config", target: "current" },
            { command: "sudo chown $USER:$USER <%= home %>/config <%= home %>/database.sqlite", target: "current" },
            { command: "scp -q -i ~/.ssh/<%= aliajs_key_name %>.pem -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ubuntu@<%= server_name %>:<%= home %>/config <%= temp %>/config", target: "orchestrator" },
            { command: "scp -q -i ~/.ssh/<%= aliajs_key_name %>.pem -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ubuntu@<%= server_name %>:<%= home %>/database.sqlite <%= temp %>/database.sqlite", target: "orchestrator" },
            { command: "scp -q -i ~/.ssh/<%= aliajs_key_name %>.pem -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null <%= temp %>/database.sqlite ubuntu@<%= address %>:<%= home %>/database.sqlite", target: "orchestrator" },
            { command: "scp -q -i ~/.ssh/<%= aliajs_key_name %>.pem -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null <%= temp %>/config ubuntu@<%= address %>:<%= home %>/config", target: "orchestrator" },
            { command: "cd <%= home %>/<%= unique_service_name %>/n8n && sudo docker-compose up -d", target: "new" },
          ]
        }
      },
      {
        "name": "n8n",
        "tier": "production",
        "type": "nginx",
        "domains": [
          "n8n.bainultra.dev",
        ],
        "locations": [
          {
            "location": "/",
            "proxy_pass": "http://127.0.0.1:5678",
          },
        ],
      }
    ]
  },
  {
    "name": "sauce-production",
    "type": "t2.micro",
    // "address": "2600:1f11:900:ec00::1",
    // "type": {
    //   "type": "flyio",
    //   "memory_mb": 256,
    //   "cpus": 1,
    //   "cpu_kind": "shared",
    //   "gpus": 0,
    //   "region": "yyz",
    // },
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
      }
    ]
  },
  {
    "name": "aliajs-production",
    "address": "15.157.29.183",
    "type": "t2.micro",
    "services": [
      {
        "name": "aliajs",
        "tier": "production",
        "language": "javascript",
        "type": "nodejs",
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
