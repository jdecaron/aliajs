const { getItem, items } = require('../src/items')

exports.instances = [
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
        "remote_repository": "https://github.com/jdecaron/aliajs-demo-backend.git",
      },
      {
        "name": "aliajs-demo-frontend",
        "tier": "production",
        "type": "nginx",
        "domains": [
          "aliajs-demo-frontend-production.rotat.io",
        ],
        "locations": [
          {
            "location": "/",
            "build": "aliajs-demo-frontend",
          },
          {
            "location": "/backend/",
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
