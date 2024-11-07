exports.instances = [
  {
    "name": "aliajs-production",
    "address": "15.157.29.183",
    // "imageName": "aliajs-node-18-ami",
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
  {
    "name": "champignonniere-production",
    "address": "35.183.159.96",
    // "imageName": "aliajs-node-18-ami",
    "type": "t3a.medium",
    "services": [
      {
        "name": "champignonniere",
        "tier": "production",
        "type": "nginx",
        "domains": [
          "champignonniere-production.rotat.io",
        ],
        "locations": [
          {
            "location": "/",
            "proxy_pass": "http://127.0.0.1:8000/",
          },
        ],
        "setup": {
          "initial": [
            { command: "sudo apt-get update", target: "new" },
            { command: "sudo apt-get -y install git python-is-python3 python3-dev python3-pip redis-server", target: "new" },
            { command: "sudo apt-get -y install mariadb-server mariadb-client", target: "new" },
            { command: "sudo mysqladmin --user=root password sauce", target: "new" },
            { command: "sudo apt-get -y install supervisor", target: "new" },
            { command: "sudo apt-get -y install python3.12-venv", target: "new" },
            { command: "npm install -g yarn", target: "new" },
            { command: "sudo ln -f -s <%= home %>/opt/node-v*/bin/yarn /usr/bin/yarn", target: "new" },
            { command: "sudo pip3 install --break-system-packages frappe-bench", target: "new" },
            { command: "cd <%= home %> && bench init frappe-bench", target: "new" },
            { command: "cd <%= home %>/frappe-bench && bench new-site --db-root-password sauce --admin-password sauce champignonniere-production.rotat.io", target: "new" },
            { command: "cd <%= home %>/frappe-bench && sudo bench setup supervisor", target: "new" },
            { command: "cd <%= home %>/frappe-bench && sudo cp config/supervisor.conf /etc/supervisor/conf.d/", target: "new" },
            { command: "sudo supervisorctl reload", target: "new" },
            { command: "cd <%= home %>/frappe-bench && bench get-app erpnext", target: "new" },
            { command: "cd <%= home %>/frappe-bench && bench --site champignonniere-production.rotat.io install-app erpnext", target: "new" },
          ]
        }
      }
    ]
  },
]
