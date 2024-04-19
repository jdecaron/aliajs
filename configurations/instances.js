exports.instances = [
  {
    "name": "aliajs-production",
    "address": "15.157.29.183",
    // "imageName": "aliajs-node-18-ami",
    "type": "t3a.nano",
    "services": [
      {
        "name": "aliajs",
        "language": "javascript",
        "tier": "production",
        "type": "express",
        "setup": {
          "initial": [
            { command: "npm install -g @bitwarden/cli", target: "new" },
            { command: "sudo ln -s $HOME/opt/node-v*/bin/bw /usr/bin/bw", target: "new" },
            { command: "echo \"Host * \n  StrictHostKeyChecking no\n  IdentityFile ~/.ssh/<%= aliajs_key_name %>.pem\n\nHost gitlab.com\n  IdentityFile ~/.ssh/gitlab.pem\" > ~/.ssh/config", target: "new" },
            { command: "scp -q -i ~/.ssh/<%= aliajs_key_name %>.pem -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ~/.ssh/<%= aliajs_key_name %>.pem ubuntu@<%= address %>:.ssh/<%= aliajs_key_name %>.pem", target: "orchestrator" },
            { command: "scp -q -i ~/.ssh/<%= aliajs_key_name %>.pem -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ~/.ssh/gitlab.pem ubuntu@<%= address %>:.ssh/gitlab.pem", target: "orchestrator" },
            { command: "sudo apt-get -y install awscli", target: "new" },
            { command: "mkdir ~/.aws", target: "new" },
            { command: "scp -q -i ~/.ssh/<%= aliajs_key_name %>.pem -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ~/.aws/credentials ubuntu@<%= address %>:.aws/credentials", target: "orchestrator" },
            { command: "scp -q -i ~/.ssh/<%= aliajs_key_name %>.pem -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ~/.aliajs-sauce-backup-9f6e7ec1 ubuntu@<%= address %>:.aliajs-sauce-backup-9f6e7ec1", target: "orchestrator" },
          ]
        }
      }
    ]
  },
]
