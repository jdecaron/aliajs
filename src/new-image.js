require('dotenv').config({ path: `${__dirname}/../.env` })

const log = require('./logger')(__filename)

const AWS = require('aws-sdk')
const items = require('./items')
const { install, SSH } = require('./utils')
const configurations = require('../configurations/images')

AWS.config.update({ region: process.env.AWS_DEFAULT_REGION })

const ec2 = new AWS.EC2()
const info = { params: {} }

// List images & deregister it if it already exists.
info.params.describeImages = {
  Owners: ['self'],
}
ec2.describeImages(info.params.describeImages).promise()
  .then(async ({ Images }) => {
    info.params.deregisterImage = []
    Images.map(async (image) => {
      const params = { ImageId: image.ImageId }
      info.params.deregisterImage.push(params)
      await ec2.deregisterImage(params).promise()
      try {
        const describeSnapshotsParams = { OwnerIds: ['self'] }
        const { Snapshots } = await ec2.describeSnapshots(describeSnapshotsParams).promise()
        for (let i = 0; i < Snapshots.length; i++) {
          const snapshot = Snapshots[i]
          if (snapshot.Description.indexOf(image.ImageId) >= 0) {
            await ec2.deleteSnapshot({ SnapshotId: snapshot.SnapshotId} ).promise()
          }
        }
      } catch (error) {
        log.error({ error, info, message: `Could not delete snapshot for image ${image?.ImageId}`, channel: 'operations' })
      }
    })

    for (const image of configurations.images) {
      // Create new instance, wait for it then install softwares & updated.
      info.params.runInstances = {
        ImageId: image.ImageId,
        InstanceType: process.env.AWS_DEFAULT_INSTANCE_TYPE,
        KeyName: process.env.ALIAJS_KEY_NAME,
        MaxCount: 1,
        MinCount: 1,
        SecurityGroupIds: ['sg-a6cc0cca', 'sg-03a9b9a03dab1f335'],
        SubnetId: process.env.AWS_DEFAULT_SUBNET_ID,
        TagSpecifications: [
          {
            ResourceType: 'instance',
            Tags: [
              {
                Key: 'Name',
                Value: 'aliajs-new-image',
              },
            ],
          },
        ],
      }
      const { Instances } = await ec2.runInstances(info.params.runInstances).promise()
      const { Reservations } = await ec2.waitFor('instanceRunning', { InstanceIds: [Instances[0].InstanceId] }).promise()
      // const { Reservations } = await ec2.waitFor('instanceRunning', { InstanceIds: ['i-0477b63509011a7d5'] }).promise()
      info.Instance = Reservations[0].Instances[0]
      await ec2.waitFor('systemStatusOk', { InstanceIds: [info.Instance.InstanceId] }).promise()

      const ssh = SSH({ address: info.Instance.PublicIpAddress, keyName: process.env.ALIAJS_KEY_NAME })
      await install({
        path: process.env.ALIAJS_DEFAULT_PATH,
        major: image.major,
        ssh,
        user: process.env.ALIAJS_DEFAULT_USER,
      })

      // Create new image.
      info.params.createImage = {
        BlockDeviceMappings: [
          {
            DeviceName: info.Instance.BlockDeviceMappings[0].DeviceName,
            Ebs: {
              VolumeSize: 16,
            },
          },
        ],
        InstanceId: info.Instance.InstanceId,
        Name: image.Name,
      }
      const { ImageId } = await ec2.createImage(info.params.createImage).promise()
      info.params.imageAvailable = { ImageIds: [ImageId] }
      await ec2.waitFor('imageAvailable', info.params.imageAvailable).promise()

      // Terminate instance.
      info.params.terminateInstances = {
        InstanceIds: [
          info.Instance.InstanceId,
        ],
      }
      await ec2.terminateInstances(info.params.terminateInstances).promise()
    }
  })
  .catch((error) => {
    log.error({ error, info, message: 'Error creating new instance image', channel: 'operations' })
  })
