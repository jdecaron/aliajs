require('dotenv').config()

const log = require('./logger')(__filename)

const AWS = require('aws-sdk')
// const ejs = require('yeahjs')
const fs = require('fs')
const util = require('util')
// const deploy = require('./deploy')
const { getNotes, items } = require('./items')
const { getDomain, exec, SSH } = require('./utils')
const configurations = require('../configurations/instances')

// AWS.config.credentials = new AWS.SharedIniFileCredentials({ profile: process.env.AWS_PROFILE })
AWS.config.update({ region: process.env.AWS_DEFAULT_REGION })

console.log(require('util').inspect(process.env, { depth: Infinity }))

const info = { params: {} }
const ec2 = new AWS.EC2()

exports.newInstance = async ({ address, imageName, keyName, name, type }) => {
  info.params.describeImages = {
    Filters: [
      {
        Name: 'name',
        Values: [
          imageName || process.env.AWS_DEFAULT_IMAGE_NAME,
        ],
      },
    ],
  }
  return ec2.describeImages(info.params.describeImages).promise()
    .then(async ({ Images }) => {
      console.log(require('util').inspect(Images, { depth: Infinity }))
      info.params.runInstances = {
        ImageId: Images[0].ImageId,
        InstanceType: type,
        KeyName: keyName,
        MaxCount: 1,
        MinCount: 1,
        SecurityGroupIds: [
          process.env.AWS_DEFAULT_SECURITY_GROUP_ID,
        ],
        SubnetId: process.env.AWS_DEFAULT_SUBNET_ID,
        TagSpecifications: [
          {
            ResourceType: 'instance',
            Tags: [
              {
                Key: 'Name',
                Value: name,
              },
            ],
          },
        ],
      }
      const { Instances } = await ec2.runInstances(info.params.runInstances).promise()

      await ec2.waitFor('systemStatusOk', { InstanceIds: [Instances[0].InstanceId] }).promise()

      if (typeof address === 'string') {
        if (address === 'allocate') {
          address = (await ec2.allocateAddress({}).promise()).PublicIp
        }
        info.params.associateAddress = {
          InstanceId: Instances[0].InstanceId,
          PublicIp: address,
        }
        await ec2.associateAddress(info.params.associateAddress).promise()
      }

      info.params.describeInstances = {
        InstanceIds: [
          Instances[0].InstanceId,
        ],
      }
      return ec2.describeInstances(info.params.describeInstances).promise()
    })
    .catch((error) => {
      log.error({ error, info, slack: 'operations' })
    })
}

exports.initInstance = async ({ address, instance, response, temp }) => {
  console.log('instance', instance)
  const { imageName, name, services, type } = instance

  const keyName = instance.keyName || process.env.HOLOCRON_KEY_NAME
  const { Reservations } = await exports.newInstance({ address, imageName, keyName, name, type })
  // const Reservations = [{
  //   Instances: [{
  //     InstanceId: '',
  //     PrivateIpAddress: '',
  //     PublicIpAddress: '',
  //   }],
  // }]
  instance.privateIpAddress = Reservations[0].Instances[0].PrivateIpAddress

  const ssh = {
    current: SSH({ address: instance.address, keyName, response }),
    new: SSH({ address: Reservations[0].Instances[0].PublicIpAddress, keyName, response }),
  }

  for (let item of items.operations) {
    const name = item.name
    if (name.match(/^authorized_keys/)) {
      await ssh.new({ command: `echo '${getNotes({ items: items.operations, name })}' >> ~/.ssh/authorized_keys`})
    }
  }

  // const filebeatConfig = await renderFile(`${__dirname}/../templates/elk/filebeat.yml`, {})
  // fs.writeFileSync(`${temp}/filebeat.yml`, filebeatConfig)
  const remoteTemp = (await ssh.new({ command: `mktemp -d` })).replace(/\s$/, '')
  await exec({ command: `rsync -az ${temp}/ ${process.env.HOLOCRON_DEFAULT_USER}@${Reservations[0].Instances[0].PublicIpAddress}:${remoteTemp}` })
  await ssh.new({ command: `sudo mv ${remoteTemp}/filebeat.yml /etc/filebeat/filebeat.yml`})
  await ssh.new({ command: 'sudo chown root:root /etc/filebeat/filebeat.yml' })
  await ssh.new({ command: 'sudo chmod 600 /etc/filebeat/filebeat.yml' })
  await ssh.new({ command: 'sudo service filebeat start' })
  await ssh.new({ command: 'sudo systemctl enable filebeat' })

  for (let j = 0; j < services.length; j++) {
    const service = services[j]
    console.log('service', service)

    let checkout
    if (service.type === 'express') {
      const directory = (await ssh.current({ command: `ls -t | grep ^${service.name} | head -n 1` })).replace(/\s$/, '')
      const status = await ssh.current({ command: `cd ${directory} && git status` })
      checkout = status.split('\n')[0].split(' ').pop()
    }

    const domains = service.domains || [`${service.name}-${service.tier}.zoneia.com`]
    for (const domain of domains) {
      const name = getDomain({ domain })
      const fullchain = getNotes({ items: items.certificates, name: `${name}/fullchain.pem` })
      const privkey = getNotes({ items: items.certificates, name: `${name}/privkey.pem` })
      const registry = getNotes({ items: items.operations, name: 'GitLab registry token' })
      await ssh.new({ command: `echo '${registry}' > ~/.npmrc`, secrets: [] })
      await ssh.new({ command: `sudo echo '${fullchain}' > fullchain.pem`, secrets: [] })
      await ssh.new({ command: `sudo mv fullchain.pem /etc/ssl/certs/${domain}.pem` })
      await ssh.new({ command: `sudo chmod 622 /etc/ssl/certs/${domain}.pem` })
      await ssh.new({ command: `sudo echo '${privkey}' > privkey.pem`, secrets: [] })
      await ssh.new({ command: `sudo mv privkey.pem /etc/ssl/private/${domain}.pem` })
      await ssh.new({ command: `sudo chmod 600 /etc/ssl/private/${domain}.pem` })
    }

    // await deploy[service.type]({
    //   address: Reservations[0].Instances[0].PublicIpAddress,
    //   checkout,
    //   exec,
    //   initial: true,
    //   instance,
    //   service,
    //   ssh,
    // })
  }

  return Reservations
}

exports.initInstances = async ({ address, instances, replace, response }) => {
  const temp = (await exec({ command: 'mktemp -d' })).replace(/\s$/, '')

  const runningReservations = (await ec2.describeInstances().promise()).Reservations

  for (let i = 0; i < instances.length; i++) {
    const instance = instances[i]
    const Reservations = await exports.initInstance({ address, instance, response, temp })

    if (replace === true) {
      try {
        if (i === instances.length - 1) {
          // This setTimeout is a temporary solution to the associateAddress
          // above that returns before the instance has its new network interface
          // fully fonctionnal. Otherwise there will be issues with the ssh commands
          // during the initTelemetryInstance process.
          // await (new Promise((resolve) => { setTimeout(resolve, 300000) }))
          await initTelemetryInstance({ response })
        }
      } catch (error) {
        log.error({ error, message: 'Error initing the telemetry instance', slack: 'operations' })
      }

      await ec2.associateAddress({
        InstanceId: Reservations[0].Instances[0].InstanceId,
        PublicIp: instance.address,
      }).promise()

      // !!!!!!!! Code below this line is not guaranteed to run on
      // holocron-orchestrator since the code below is terminating
      // instances, including the one it's running this very code.
      for (let k = 0; k < runningReservations.length; k++) {
        const runningInstances = runningReservations[k].Instances
        for (let l = 0; l < runningInstances.length; l++) {
          const runningInstance = runningInstances[l]
          const runningInstanceTags = runningInstance.Tags
          for (let m = 0; m < runningInstanceTags.length; m++) {
            const runningInstanceTag = runningInstanceTags[m]
            if (runningInstanceTag.Key === 'Name' && runningInstanceTag.Value === instance.name) {
              await ec2.terminateInstances({
                InstanceIds: [
                  runningInstance.InstanceId,
                ],
              }).promise()
            }
          }
        }
      }
    }
  }
}

async function initTelemetryInstance ({ response }) {
  const temp = (await exec({ command: 'mktemp -d' })).replace(/\s$/, '')
  const remoteInstances = (await ec2.describeInstances().promise()).Reservations

  for (const instance of configurations.instances) {
    for (const remoteInstance of remoteInstances) {
      if (instance.address === remoteInstance.Instances[0].PublicIpAddress) {
        instance.privateIpAddress = remoteInstance.Instances[0].PrivateIpAddress
      }
    }
  }

  const prometheusConfig = await renderFile(`${__dirname}/../templates/prometheus/prometheus.ejs`, { instances: configurations.instances })
  fs.writeFileSync(`${temp}/prometheus.yml`, prometheusConfig)
  await exec({ command: `cp ${__dirname}/../templates/prometheus/alerts.yml ${temp}/` })
  await exec({ command: `cp ${__dirname}/../templates/prometheus/alertmanager.yml ${temp}/` })

  const address = '35.183.191.84'
  const ssh = SSH({ address, keyName: process.env.HOLOCRON_KEY_NAME, response })
  const hostname = (await ssh({ command: `hostname` })).replace(/\s$/, '')
  const remoteTemp = (await ssh({ command: `mktemp -d` })).replace(/\s$/, '')
  await exec({ command: `rsync -az ${temp}/ ${process.env.HOLOCRON_DEFAULT_USER}@${address}:${remoteTemp}` })
  await ssh({ command: `sudo cp ${remoteTemp}/prometheus.yml /var/snap/prometheus/current/prometheus.yml` })
  await ssh({ command: `sudo cp ${remoteTemp}/alerts.yml /var/snap/prometheus/current/alerts.yml` })
  await ssh({ command: `sudo cp ${remoteTemp}/alertmanager.yml /var/snap/prometheus-alertmanager/current/alertmanager.yml` })
  await ssh({ command: `sudo service snap.prometheus.prometheus restart` })
  await ssh({ command: `sudo service snap.prometheus-alertmanager.alertmanager restart` })
}

exports.initTelemetryInstance = initTelemetryInstance
