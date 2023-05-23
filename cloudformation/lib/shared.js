import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        ScalingRole: {
            Type: 'AWS::IAM::Role',
            Properties: {
                RoleName: cf.join([cf.stackName, '-scaling-role']),
                AssumeRolePolicyDocument: {
                    Version: "2012-10-17",
                    Statement: [{
                        Effect: 'Allow',
                        Principal: {
                            Service: ['application-autoscaling.amazonaws.com'],
                        },
                        Action: [ 'sts:AssumeRole' ]
                    }]
                }
            }
        },
        ScalingRolePolicy: {
            Type: 'AWS::IAM::Policy',
            Properties: {
                Roles: [cf.ref('ScalingRole')],
                PolicyName: cf.join([cf.stackName, '-scaling-policy']),
                PolicyDocument: {
                    Version: '2012-10-17',
                    Statement: [{
                        Effect: 'Allow',
                        Action: [
                            'application-autoscaling:*',
                            'ecs:RunTask',
                            'ecs:UpdateSerice',
                            'ecs:DescribeServices',
                            'cloudwatch:PutMetricAlarm',
                            'cloudwatch:DescribeAlarms',
                            'cloudwatch:GetMetricStatistics',
                            'cloudwatch:SetAlarmState',
                            'cloudwatch:DeleteAlarms'
                        ],
                        Resource: '*'
                    }]
                }
            }
        },
        Logs: {
            Type: 'AWS::Logs::LogGroup',
            Properties: {
                LogGroupName: cf.stackName,
                RetentionInDays: 7
            }
        },
        TaskRole: {
            Type: 'AWS::IAM::Role',
            Properties: {
                AssumeRolePolicyDocument: {
                    Version: '2012-10-17',
                    Statement: [{
                        Effect: 'Allow',
                        Principal: {
                            Service: 'ecs-tasks.amazonaws.com'
                        },
                        Action: 'sts:AssumeRole'
                    }]
                },
                Policies: [{
                    PolicyName: cf.join('-', [cf.stackName, 'api-policy']),
                    PolicyDocument: {
                        Statement: [{
                            Effect: 'Allow',
                            Resource: [
                                cf.join(['arn:', cf.partition, ':s3:::', cf.ref('AssetBucket')]),
                                cf.join(['arn:', cf.partition, ':s3:::', cf.ref('AssetBucket'), '/*'])
                            ],
                            Action: '*'
                        },{
                            Effect: 'Allow',
                            Action: [
                                'ecr:Describe*',
                                'ecr:Get*',
                                'ecr:List*'
                            ],
                            Resource: [
                                cf.join(['arn:', cf.partition, ':ecr:', cf.region, ':', cf.accountId, ':repository/sam-service'])
                            ]
                        }]
                    }
                }]
            }
        },
        ExecRole: {
            Type: 'AWS::IAM::Role',
            Properties: {
                AssumeRolePolicyDocument: {
                    Version: '2012-10-17',
                    Statement: [{
                        Effect: 'Allow',
                        Principal: {
                            Service: 'ecs-tasks.amazonaws.com'
                        },
                        Action: 'sts:AssumeRole'
                    }]
                },
                Policies: [{
                    PolicyName: cf.join([cf.stackName, '-api-logging']),
                    PolicyDocument: {
                        Statement: [{
                            Effect: 'Allow',
                            Action: [
                                'logs:CreateLogGroup',
                                'logs:CreateLogStream',
                                'logs:PutLogEvents',
                                'logs:DescribeLogStreams'
                            ],
                            Resource: [cf.join(['arn:', cf.partition, ':logs:*:*:*'])]
                        }]
                    }
                }],
                ManagedPolicyArns: [
                    cf.join(['arn:', cf.partition, ':iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy'])
                ],
                Path: '/service-role/'
            }
        }
    }
};
