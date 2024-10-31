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
            { command: "sudo ln -f -s $HOME/opt/node-v*/bin/bw /usr/bin/bw", target: "new" },
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
        "language": "javascript",
        "tier": "production",
        "type": "nginx",
        "remote_repository": "https://github.com/jdecaron/aliajs.git",
        "setup": {
          "initial": [
            { command: "sudo apt-get -y install docker-compose", target: "new" },
          ]
        }
      }
    ]
  },
]
