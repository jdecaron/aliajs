const { getItem, items } = require('../src/items')

exports.instances = [
  {
    "name": "redis-demo",
    "address": "3.97.235.183",
    "type": "t3a.small",
    "services": [
      {
        "name": "redis-replication-demo",
        "tier": "production",
        "type": "redis",
        "setup": {
          "initial": [
            { command: "sudo apt-get -y install redis", target: "new" },
            { command: "sudo sed -i 's/^bind 127.0.0.1 -::1$/bind * -::*/g' /etc/redis/redis.conf", target: "new" },
            { command: "sudo sed -i 's/^protected-mode yes$/protected-mode no/g' /etc/redis/redis.conf", target: "new" },
            { command: "sudo sed -i 's/^replica-read-only yes$/replica-read-only no/g' /etc/redis/redis.conf", target: "new" },
            { command: "sudo systemctl daemon-reload", target: "new" },
            { command: "sudo service redis-server restart", target: "new" },
            { command: "redis-cli get test", target: "new" },
          ],
        },
      },
    ]
  },
  {
    "name": "aliajs-demo",
    "address": "35.182.87.59",
    "type": "t3a.small",
    "services": [
      {
        "name": "aliajs-demo-backend",
        "language": "typescript",
        "tier": "production",
        "type": "nodejs",
        "setup": {
          "initial": [
            { command: "sudo apt-get -y install redis", target: "new" },
            { command: "sudo sed -i 's/^bind 127.0.0.1 -::1$/bind * -::*/g' /etc/redis/redis.conf", target: "new" },
            { command: "sudo sed -i 's/^protected-mode yes$/protected-mode no/g' /etc/redis/redis.conf", target: "new" },
            { command: "sudo systemctl daemon-reload", target: "new" },
            { command: "sudo service redis-server restart", target: "new" },
            { command: "redis-cli get test", target: "new" },
          ],
        },
        "remote_repository": "https://github.com/jdecaron/aliajs-demo-backend.git",
      },
      {
        "name": "aliajs-demo-frontend",
        "tier": "production",
        "type": "nginx",
        "domains": [
          "aliajs-demo-frontend-production.rotat.io",
          "demo.rotat.io",
        ],
        "locations": [
          {
            "location": "/",
            "build": "aliajs-demo-frontend",
            "split": [ { "checkout": "main", "split": 90 }, { "checkout": "split-b", "split": 10 } ],
          },
          {
            "location": "/api/v0/",
            "proxy_pass": "https://aliajs-demo-backend-production.rotat.io/",
          },
        ],
        "remote_repository": "https://github.com/jdecaron/aliajs-demo-frontend.git",
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
