import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        ELB: {
            Type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
            Properties: {
                Name: cf.stackName,
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
        ELBSecurityGroup: {
            Type : 'AWS::EC2::SecurityGroup',
            Properties : {
                GroupDescription: cf.join('-', [cf.stackName, 'elb-sg']),
                SecurityGroupIngress: [{
                    CidrIp: '0.0.0.0/0',
                    IpProtocol: 'tcp',
                    FromPort: 443,
                    ToPort: 443
                },{
                    CidrIp: '0.0.0.0/0',
                    IpProtocol: 'tcp',
                    FromPort: 80,
                    ToPort: 80
                }],
                VpcId: cf.ref('VpcId')
            }
        },
        HttpsListener: {
            Type: 'AWS::ElasticLoadBalancingV2::Listener',
            Properties: {
                Certificates: [{
                    CertificateArn: cf.join(['arn:', cf.partition, ':acm:', cf.region, ':', cf.accountId, ':certificate/', cf.ref('SSLCertificateIdentifier')])
                }],
                DefaultActions: [{
                    Type: 'forward',
                    TargetGroupArn: cf.ref('TargetGroup')
                }],
                LoadBalancerArn: cf.ref('ELB'),
                Port: 443,
                Protocol: 'HTTPS'
            }
        },
        HttpListener: {
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
                LoadBalancerArn: cf.ref('ELB'),
                Port: 80,
                Protocol: 'HTTP'
            }
        },
        TargetGroup: {
            Type: 'AWS::ElasticLoadBalancingV2::TargetGroup',
            DependsOn: 'ELB',
            Properties: {
                HealthCheckEnabled: true,
                HealthCheckIntervalSeconds: 30,
                HealthCheckPath: '/ping',
                HealthCheckPort: 7080,
                Port: 7080,
                Protocol: 'HTTP',
                TargetType: 'ip',
                VpcId: cf.ref('VpcId'),
                Matcher: {
                    HttpCode: '200,202,302,304'
                }
            }
        },
        ECSCluster: {
            Type: 'AWS::ECS::Cluster',
            Properties: {
                ClusterName: cf.join('-', [cf.stackName, 'cluster'])
            }
        },
        TaskDefinition: {
            Type: 'AWS::ECS::TaskDefinition',
            Properties: {
                Family: cf.stackName,
                Cpu: 1024,
                Memory: 8192,
                NetworkMode: 'awsvpc',
                RequiresCompatibilities: ['FARGATE'],
                EphemeralStorage: {
                    SizeInGiB: '100'
                },
                Tags: [{
                    Key: 'Name',
                    Value: cf.join('-', [cf.stackName, 'api'])
                }],
                ExecutionRoleArn: cf.getAtt('ExecRole', 'Arn'),
                TaskRoleArn: cf.getAtt('TaskRole', 'Arn'),
                ContainerDefinitions: [{
                    Name: 'api',
                    Image: cf.join([cf.accountId, '.dkr.ecr.', cf.region, '.amazonaws.com/sam-service:cpu-', cf.ref('GitSha')]),
                    PortMappings: [{
                        ContainerPort: 7080
                    }],
                    Environment: [
                        { Name: 'StackName', Value: cf.stackName },
                        { Name: 'GitSha', Value: cf.ref('GitSha') },
                        { Name: 'AWS_DEFAULT_REGION', Value: cf.region }
                    ],
                    LogConfiguration: {
                        LogDriver: 'awslogs',
                        Options: {
                            'awslogs-group': cf.join([cf.stackName, '-cpu']),
                            'awslogs-region': cf.region,
                            'awslogs-stream-prefix': cf.stackName,
                            'awslogs-create-group': true
                        }
                    },
                    Essential: true
                }]
            }
        },
        Service: {
            Type: 'AWS::ECS::Service',
            Properties: {
                ServiceName: cf.join('-', [cf.stackName, 'Service']),
                Cluster: cf.ref('ECSCluster'),
                TaskDefinition: cf.ref('TaskDefinition'),
                LaunchType: 'FARGATE',
                HealthCheckGracePeriodSeconds: 300,
                DesiredCount: 1,
                NetworkConfiguration: {
                    AwsvpcConfiguration: {
                        AssignPublicIp: 'ENABLED',
                        SecurityGroups: [cf.ref('ServiceSecurityGroup')],
                        Subnets:  [
                            cf.ref('PublicSubnetA'),
                            cf.ref('PublicSubnetB')
                        ]
                    }
                },
                LoadBalancers: [{
                    ContainerName: 'api',
                    ContainerPort: 7080,
                    TargetGroupArn: cf.ref('TargetGroup')
                }]
            }
        },
        ServiceSecurityGroup: {
            Type: 'AWS::EC2::SecurityGroup',
            Properties: {
                GroupDescription: cf.join('-', [cf.stackName, 'ec2-sg']),
                VpcId: cf.ref('VpcId'),
                SecurityGroupIngress: [{
                    CidrIp: '0.0.0.0/0',
                    IpProtocol: 'tcp',
                    FromPort: 7080,
                    ToPort: 7080
                }]
            }
        },
    },
    Outputs: {
        API: {
            Description: 'API ELB',
            Value: cf.join(['http://', cf.getAtt('ELB', 'DNSName')])
        }
    }
};
