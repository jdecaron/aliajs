require('dotenv').config()

const log = require('./logger')(__filename)

const AWS = require('aws-sdk')
const ejs = require('ejs')
const fs = require('fs')
const util = require('util')
const deploy = require('./deploy')
const { getNotes, items } = require('./items')
const { getDomain, exec, SSH } = require('./utils')
const configurations = require('../configurations/instances')

const renderFile = util.promisify(ejs.renderFile)

AWS.config.update({ region: process.env.AWS_DEFAULT_REGION })

const info = { params: {} }
const ec2 = new AWS.EC2()

exports.newInstance = async ({ address, imageName, keyName, instance, name, type }) => {
  let SecurityGroupIds = ['sg-a6cc0cca', 'sg-03a9b9a03dab1f335', 'sg-014419c2799d52b95']

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
      info.params.runInstances = {
        ImageId: Images[0].ImageId,
        InstanceType: type,
        KeyName: keyName,
        MaxCount: 1,
        MinCount: 1,
        SecurityGroupIds,
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
      log.error({ error, info, channel: 'operations' })
    })
}

exports.initInstance = async ({ address, instance, refresh, response, temp }) => {
  const { imageName, name, services, type } = instance

  const keyName = instance.keyName || process.env.ALIAJS_KEY_NAME
  const { Reservations } = await exports.newInstance({ address, imageName, keyName, instance, name, type })
  // const { Reservations } = await ec2.waitFor('instanceRunning', { InstanceIds: ['i-0bb05f291bb32cda9'] }).promise()
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

  for (let j = 0; j < services.length; j++) {
    const service = services[j]

    let checkout
    if (refresh === true && service.type === 'express') {
      const directory = (await ssh.current({ command: `ls -t | grep ^${service.name} | head -n 1` })).replace(/\s$/, '')

      const status = await ssh.current({ command: `cd ${directory} && git status` })
      checkout = status.split('\n')[0].split(' ').pop()
    }

    const domains = service.domains || [`${service.name}-${service.tier}.${process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN}`]
    for (const domain of domains) {
      const name = getDomain({ domain })
      const fullchain = getNotes({ items: items.certificates, name: `${name}/fullchain.pem` })
      const privkey = getNotes({ items: items.certificates, name: `${name}/privkey.pem` })
      await ssh.new({ command: `sudo echo '${fullchain}' > fullchain.pem`, secrets: [] })
      await ssh.new({ command: `sudo mv fullchain.pem /etc/ssl/certs/${domain}.pem` })
      await ssh.new({ command: `sudo chmod 622 /etc/ssl/certs/${domain}.pem` })
      await ssh.new({ command: `sudo echo '${privkey}' > privkey.pem`, secrets: [] })
      await ssh.new({ command: `sudo mv privkey.pem /etc/ssl/private/${domain}.pem` })
      await ssh.new({ command: `sudo chmod 600 /etc/ssl/private/${domain}.pem` })
    }

    await deploy[service.type]({
      address: Reservations[0].Instances[0].PublicIpAddress,
      checkout,
      exec,
      initial: true,
      instance,
      service,
      ssh,
    })
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
      if (typeof instance.address === 'string') {
        await ec2.associateAddress({
          InstanceId: Reservations[0].Instances[0].InstanceId,
          PublicIp: instance.address,
        }).promise()
      }

      // !!!!!!!! Code below this line is not guaranteed to run on aliajs
      // since the code below is terminating instances. aliajs could
      // be terminated (shutdown) before it can finish this for loop.
      // That's why aliajs is the last item of instances[].
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
