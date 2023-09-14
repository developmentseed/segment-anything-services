import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        /*
        GPULogs: {
            Type: 'AWS::Logs::LogGroup',
            Properties: {
                LogGroupName: cf.join([cf.stackName, '-cpu']),
                RetentionInDays: 7
            }
        },
        */
        GPUNoTrafficAlarm: {
            Type: 'AWS::CloudWatch::Alarm',
            Properties: {
                AlarmName: cf.join([cf.stackName, '-no-gpu-traffic']),
                ActionsEnabled: true,
                OKActions: [],
                AlarmActions: [cf.ref('GPUServiceAutoScalingPolicy')],
                InsufficientDataActions: [],
                MetricName: 'RequestCountPerTarget',
                Namespace: 'AWS/ApplicationELB',
                Statistic: 'Sum',
                Dimensions: [{
                    Name: 'TargetGroup',
                    Value: cf.getAtt('GPUTargetGroup', 'TargetGroupFullName')
                }],
                Period: 1200,
                EvaluationPeriods: 4,
                DatapointsToAlarm: 4,
                Threshold: 0,
                ComparisonOperator: 'LessThanOrEqualToThreshold',
                TreatMissingData: 'breaching'
            }
        },
        GPUServiceAutoScalingTarget: {
            Type: 'AWS::ApplicationAutoScaling::ScalableTarget',
            Properties: {
                MaxCapacity: 1,
                MinCapacity: 0,
                ResourceId: cf.join(['service/', cf.ref('ECSCluster'), '/', cf.getAtt('GPUService', 'Name')]),
                RoleARN: cf.getAtt('ScalingRole', 'Arn'),
                ScalableDimension: 'ecs:service:DesiredCount',
                ServiceNamespace: 'ecs'
            }
        },
        GPUServiceAutoScalingPolicy: {
            Type: 'AWS::ApplicationAutoScaling::ScalingPolicy',
            DependsOn: ['GPUServiceAutoScalingTarget'],
            Properties: {
                PolicyName: cf.join([cf.stackName, '-gpu-autoscaling']),
                PolicyType: 'StepScaling',
                ResourceId: cf.join(['service/', cf.ref('ECSCluster'), '/', cf.getAtt('GPUService', 'Name')]),
                ScalableDimension: 'ecs:service:DesiredCount',
                ServiceNamespace: 'ecs',
                StepScalingPolicyConfiguration: {
                    AdjustmentType: 'ChangeInCapacity',
                    Cooldown: 60,
                    MetricAggregationType: 'Maximum',
                    StepAdjustments: [{
                        MetricIntervalUpperBound: 0,
                        ScalingAdjustment: -1
                    }]
                }
            }
        },
        GPUECSCapacityProvider: {
            Type: 'AWS::ECS::CapacityProvider',
            Properties: {
                AutoScalingGroupProvider: {
                    AutoScalingGroupArn: cf.ref('ECSAutoScalingGroup'),
                    ManagedScaling: {
                        MaximumScalingStepSize: 1,
                        MinimumScalingStepSize: 1,
                        Status: 'ENABLED',
                        TargetCapacity: 100
                    },
                    ManagedTerminationProtection: 'ENABLED'
                }
            }
        },
        GPUECSCapacityProviderAssoc: {
            Type : 'AWS::ECS::ClusterCapacityProviderAssociations',
            Properties : {
                CapacityProviders : [cf.ref('GPUECSCapacityProvider')],
                Cluster: cf.ref('ECSCluster'),
                DefaultCapacityProviderStrategy: [{
                    Base: 0,
                    CapacityProvider: cf.ref('GPUECSCapacityProvider'),
                    Weight: 1
                }]
            }
        },
        GPUELB: {
            Type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
            Properties: {
                Type: 'application',
                SecurityGroups: [cf.ref('ELBSecurityGroup')],
                LoadBalancerAttributes: [{
                    Key: 'idle_timeout.timeout_seconds',
                    Value:  '4000'
                }],
                Subnets:  [
                    cf.ref('PublicSubnetA'),
                    cf.ref('PublicSubnetB')
                ]
            }

        },
        GPUHttpsListener: {
            Type: 'AWS::ElasticLoadBalancingV2::Listener',
            Properties: {
                Certificates: [{
                    CertificateArn: cf.join(['arn:', cf.partition, ':acm:', cf.region, ':', cf.accountId, ':certificate/', cf.ref('SSLCertificateIdentifier')])
                }],
                DefaultActions: [{
                    Type: 'forward',
                    TargetGroupArn: cf.ref('GPUTargetGroup')
                }],
                LoadBalancerArn: cf.ref('GPUELB'),
                Port: 443,
                Protocol: 'HTTPS'
            }
        },
        GPUHttpListener: {
            Type: 'AWS::ElasticLoadBalancingV2::Listener',
            Properties: {
                DefaultActions: [{
                    Type: 'redirect',
                    RedirectConfig: {
                        Protocol: 'HTTPS',
                        StatusCode: 'HTTP_301',
                        Port: 443
                    }
                }],
                LoadBalancerArn: cf.ref('GPUELB'),
                Port: 80,
                Protocol: 'HTTP'
            }
        },
        GPUTargetGroup: {
            Type: 'AWS::ElasticLoadBalancingV2::TargetGroup',
            DependsOn: 'GPUELB',
            Properties: {
                HealthCheckEnabled: true,
                HealthCheckIntervalSeconds: 30,
                HealthCheckPath: '/ping',
                HealthCheckPort: 'traffic-port',
                Port: 8080,
                Protocol: 'HTTP',
                VpcId: cf.ref('VpcId'),
                Matcher: {
                    HttpCode: '200,202,302,304'
                }
            }
        },
        ECSAutoScalingGroup: {
            Type: 'AWS::AutoScaling::AutoScalingGroup',
            DependsOn: ['GPUService'],
            Properties: {
                AutoScalingGroupName: cf.stackName,
                VPCZoneIdentifier: [
                    cf.ref('PublicSubnetA'),
                    cf.ref('PublicSubnetB')
                ],
                NewInstancesProtectedFromScaleIn: true,
                LaunchConfigurationName: cf.ref('ECSGPUContainerInstances'),
                MinSize: 0,
                MaxSize: 1,
                DesiredCapacity: 1
            },
            CreationPolicy: {
                ResourceSignal: {
                    Timeout: 'PT15M'
                }
            },
            UpdatePolicy: {
                AutoScalingReplacingUpdate: {
                    WillReplace: 'true'
                }
            }
        },
        ECSEC2InstanceProfile: {
            Type: 'AWS::IAM::InstanceProfile',
            Properties: {
                Path: '/',
                Roles: [cf.ref('EC2Role')]
            }
        },
        ECSServiceRole: {
            Type: 'AWS::IAM::Role',
            Properties: {
                AssumeRolePolicyDocument: {
                    Statement: [{
                        Effect: 'Allow',
                        Principal: {
                            Service: [ 'ecs.amazonaws.com' ]
                        },
                        Action: [ 'sts:AssumeRole' ]
                    }]
                },
                Path: '/',
                Policies: [{
                    PolicyName: 'ecs-service',
                    PolicyDocument: {
                        Statement: [{
                            Effect: 'Allow',
                            Action: [
                                'elasticloadbalancing:DeregisterInstancesFromLoadBalancer',
                                'elasticloadbalancing:DeregisterTargets',
                                'elasticloadbalancing:Describe*',
                                'elasticloadbalancing:RegisterInstancesWithLoadBalancer',
                                'elasticloadbalancing:RegisterTargets',
                                'ec2:Describe*',
                                'ec2:AuthorizeSecurityGroupIngress'
                            ],
                            Resource: '*'
                        }]
                    }
                }]
            }
        },
        EC2Role: {
            Type: 'AWS::IAM::Role',
            Properties: {
                AssumeRolePolicyDocument: {
                    Statement: [{
                        Effect: 'Allow',
                        Principal: {
                            Service: ['ec2.amazonaws.com']
                        },
                        Action: ['sts:AssumeRole']
                    }]
                },
                Path: '/',
                Policies: [{
                    PolicyName: 'ecs-service',
                    PolicyDocument: {
                        Statement: [{
                            Effect: 'Allow',
                            Action: [
                                'ecs:CreateCluster',
                                'ecs:DeregisterContainerInstance',
                                'ecs:UpdateContainerInstancesState',
                                'ecs:DiscoverPollEndpoint',
                                'ecs:Poll',
                                'ecs:RegisterContainerInstance',
                                'ecs:StartTelemetrySession',
                                'ecs:Submit*',
                                'logs:*'
                            ],
                            Resource: '*'
                        }]
                    }
                }]
            }
        },
        GPUEcsHostSecurityGroup: {
            Type: 'AWS::EC2::SecurityGroup',
            Properties: {
                GroupDescription: cf.join([cf.stackName, ' - Access to the ECS hosts that run containers']),
                VpcId: cf.ref('VpcId')
            }
        },
        GPUEcsSecurityGroupIngressFromPublicALB: {
            Type: 'AWS::EC2::SecurityGroupIngress',
            Properties: {
                Description: cf.join([cf.stackName, ' - Ingress from the public ALB']),
                GroupId: cf.ref('GPUEcsHostSecurityGroup'),
                IpProtocol: -1,
                SourceSecurityGroupId: cf.ref('ELBSecurityGroup')
            }
        },
        GPIEcsSecurityGroupIngressFromSelf: {
            Type: 'AWS::EC2::SecurityGroupIngress',
            Properties: {
                Description: cf.join([cf.stackName, ' - Ingress from other hosts in the same security group']),
                GroupId: cf.ref('GPUEcsHostSecurityGroup'),
                IpProtocol: -1,
                SourceSecurityGroupId: cf.ref('GPUEcsHostSecurityGroup')
            }
        },
        ECSGPUContainerInstances: {
            Type: 'AWS::AutoScaling::LaunchConfiguration',
            Properties: {
                ImageId: 'ami-0035a5a4b40951ded',
                InstanceType: 'p3.2xlarge',
                SecurityGroups: [cf.ref('GPUEcsHostSecurityGroup')],
                IamInstanceProfile: cf.ref('ECSEC2InstanceProfile'),
                BlockDeviceMappings: [{
                    DeviceName: '/dev/sdf',
                    Ebs: {
                        DeleteOnTermination: true,
                        VolumeSize: 100
                    }
                }],
                UserData: {
                    'Fn::Base64': {
                        'Fn::Join': [
                            '',
                            [
                                '#!/bin/bash -xe\n',
                                '# create mount point directory\n',
                                'mkdir /mnt/xvdf\n',
                                '# create ext4 filesystem on new volume\n',
                                'mkfs -t ext4 /dev/xvdf\n',
                                '# add an entry to fstab to mount volume during boot\n',
                                'echo "/dev/xvdf       /mnt/xvdf   ext4    defaults,nofail 0       2" >> /etc/fstab\n',
                                '# mount the volume on current boot\n',
                                'mount -a\n',
                                'echo ECS_CLUSTER=', cf.ref('ECSCluster'), ' >> /etc/ecs/ecs.config\n',
                                'echo ECS_IMAGE_PULL_BEHAVIOR=prefer-cached >> /etc/ecs/ecs.config\n',
                                'yum install -y aws-cfn-bootstrap\n',
                                '/opt/aws/bin/cfn-signal -e $? ',
                                '         --stack ',
                                cf.stackName,
                                '         --resource ECSAutoScalingGroup ',
                                '         --region ',
                                cf.region,
                                '\n'
                            ]
                        ]
                    }
                }
            }
        },
        GPUTaskDefinition: {
            Type: 'AWS::ECS::TaskDefinition',
            Properties: {
                Family: cf.join([cf.stackName, '-gpu']),
                Cpu: 1024,
                Memory: 8192,
                Tags: [{
                    Key: 'Name',
                    Value: cf.join('-', [cf.stackName, 'gpu-api'])
                }],
                ExecutionRoleArn: cf.getAtt('ExecRole', 'Arn'),
                TaskRoleArn: cf.getAtt('TaskRole', 'Arn'),
                Volumes: [{
                    Name: 'ModelStorage',
                    Host: {
                        SourcePath: '/mnt/xvdf'
                    }
                }],
                ContainerDefinitions: [{
                    Name: 'gpu-api',
                    MountPoints: [{
                        SourceVolume: 'ModelStorage',
                        ContainerPath: '/home/model-server/volume'
                    }],
                    Image: cf.join([cf.accountId, '.dkr.ecr.', cf.region, '.amazonaws.com/sam-service:gpu-', cf.ref('GitSha')]),
                    PortMappings: [{
                        ContainerPort: 8080
                    }],
                    ResourceRequirements: [{
                        Type: 'GPU',
                        Value: 1
                    }],
                    Environment: [
                        { Name: 'StackName', Value: cf.stackName },
                        { Name: 'GitSha', Value: cf.ref('GitSha') },
                        { Name: 'AWS_DEFAULT_REGION', Value: cf.region }
                    ],
                    LogConfiguration: {
                        LogDriver: 'awslogs',
                        Options: {
                            'awslogs-group': cf.join([cf.stackName, '-gpu']),
                            'awslogs-region': cf.region,
                            'awslogs-stream-prefix': cf.stackName,
                            'awslogs-create-group': true
                        }
                    },
                    Essential: true
                }]
            }
        },
        GPUService: {
            Type: 'AWS::ECS::Service',
            DependsOn: ['GPUELB', 'GPUHttpsListener'],
            Properties: {
                ServiceName: cf.join('-', [cf.stackName, 'GPUService']),
                Cluster: cf.ref('ECSCluster'),
                TaskDefinition: cf.ref('GPUTaskDefinition'),
                HealthCheckGracePeriodSeconds: 300,
                DesiredCount: 1,
                Role: cf.ref('ECSServiceRole'),
                LoadBalancers: [{
                    ContainerName: 'gpu-api',
                    ContainerPort: 8080,
                    TargetGroupArn: cf.ref('GPUTargetGroup')
                }]
            }
        },
        GPUServiceSecurityGroup: {
            Type: 'AWS::EC2::SecurityGroup',
            Properties: {
                GroupDescription: cf.join('-', [cf.stackName, 'ec2-sg']),
                VpcId: cf.ref('VpcId'),
                SecurityGroupIngress: [{
                    CidrIp: '0.0.0.0/0',
                    IpProtocol: 'tcp',
                    FromPort: 8080,
                    ToPort: 8080
                }]
            }
        }
    },
    Outputs: {
        GPU: {
            Description: 'GPU API ELB',
            Value: cf.join(['http://', cf.getAtt('GPUELB', 'DNSName')])
        }
    }
};
