require('dotenv').config()

const log = require('../logger')(__filename)

const AWS = require('aws-sdk')

AWS.config.update({ region: process.env.AWS_DEFAULT_REGION })

const ec2 = new AWS.EC2()
const info = { params: {} }

exports.EC2NewInstance = async ({ address, imageName, keyName, instance, name, type }) => {
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
