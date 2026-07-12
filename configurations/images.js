import { getLatestNode, installNode } from '../src/utils.js'

const templates = {
  [process.env.ALIAJS_DEFAULT_IMAGE_NAME]: {
    initial: [
      { command: async ({ c }) => {
        const major = c.data.nodejs.major
        const path = c.data.path
        const user = c.data.user

        await c.ssh.new({ command: `adduser --disabled-password --gecos "" ubuntu`, user: 'root' })
        await c.ssh.new({ command: `usermod -aG sudo ubuntu`, user: 'root' })
        await c.ssh.new({ command: `echo 'ubuntu ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/ubuntu && chmod 440 /etc/sudoers.d/ubuntu`, user: 'root' })
        await c.ssh.new({ command: `mkdir -p /home/ubuntu/.ssh && chmod 700 /home/ubuntu/.ssh`, user: 'root' })
        await c.ssh.new({ command: `cp /root/.ssh/authorized_keys /home/ubuntu/.ssh/authorized_keys`, user: 'root' })
        await c.ssh.new({ command: `chown -R ubuntu:ubuntu /home/ubuntu/.ssh && chmod 600 /home/ubuntu/.ssh/authorized_keys`, user: 'root' })

        await c.ssh.new({ command: `sudo mkdir ${path}` })
        await c.ssh.new({ command: `sudo chown ${user} ${path}` })
        await c.ssh.new({ command: `echo 'LineMax=1M' | sudo tee -a /etc/systemd/journald.conf` })
        await c.ssh.new({ command: `echo '$MaxMessageSize 64k' | sudo tee -a /etc/rsyslog.conf` })

        await c.ssh.new({ command: 'sudo apt-get update' })
        await c.ssh.new({ command: 'sudo apt-get -y install restic' })
        await c.ssh.new({ command: 'sudo apt-get -y install nginx' })
        await c.ssh.new({ command: 'sudo apt-get -y install libnginx-mod-http-lua' })
        await c.ssh.new({ command: 'sudo apt-get -y install lua-nginx-cookie' })
        await c.ssh.new({ command: 'sudo rm /etc/nginx/sites-enabled/default' })
        await c.ssh.new({ command: 'sudo ln /usr/share/nginx/modules-available/mod-http-lua.conf /usr/share/nginx/modules-enabled' })

        const latestNode = await getLatestNode({ major })
        for (const command of installNode({ path, latestNode, major })) {
          await c.ssh.new({ command })
        }
        await c.ssh.new({ command: `sudo ln -f -s ${path}/opt/${latestNode.path}/bin/node /usr/bin/node` })
        await c.ssh.new({ command: `sudo ln -f -s ${path}/opt/${latestNode.path}/bin/npm /usr/bin/npm` })
        await c.ssh.new({ command: `sudo ln -f -s ${path}/opt/${latestNode.path}/bin/npx /usr/bin/npx` })

        await c.ssh.new({ command: 'sudo unattended-upgrade -d' })
      }},
    ],
  }
}

export const images = [
  {
    ImageId: process.env.ALIAJS_DEFAULT_IMAGE_ID,
    Name: process.env.ALIAJS_DEFAULT_IMAGE_NAME,
    operations: templates[process.env.ALIAJS_DEFAULT_IMAGE_NAME],
    data: {
      nodejs: { major: '24' },
      path: process.env.ALIAJS_DEFAULT_PATH,
      user: process.env.ALIAJS_DEFAULT_USER,
    },
  },
  {
    ImageId: process.env.ALIAJS_DEFAULT_IMAGE_ID,
    Name: 'aliajs-erpnext-15',
    operations: (() => {
      return {
        initial: templates[process.env.ALIAJS_DEFAULT_IMAGE_NAME].initial.concat(
          { command: "sudo apt-get update", target: "new" },
          { command: "sudo apt-get -y install git python-is-python3 python3-dev python3-pip redis-server pkg-config", target: "new" },
          { command: "sudo apt-get -y install mariadb-server mariadb-client libmariadb-dev", target: "new" },
          { command: "sudo apt-get -y install supervisor", target: "new" },
          { command: "sudo apt-get -y install python3.12-venv", target: "new" },
          { command: "npm install -g yarn", target: "new" },
          { command: "sudo ln -f -s <%= path %>/opt/node-v*/bin/yarn /usr/bin/yarn", target: "new" },
          { command: "sudo pip3 install --break-system-packages frappe-bench", target: "new" },
          { command: "cd <%= path %> && bench init frappe-bench --frappe-branch version-15", target: "new" },
        )
      }
    })(),
    data: {
      nodejs: { major: '24' },
      path: process.env.ALIAJS_DEFAULT_PATH,
      user: process.env.ALIAJS_DEFAULT_USER,
    },
  },
]
