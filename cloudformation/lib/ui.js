import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        REstApiRoute53: {
            Type: 'AWS::Route53::RecordSet',
            Properties: {
                Name: cf.join(['api.', cf.ref('RootDomain')]),
                Type: 'A',
                HostedZoneId: cf.ref('RootDomainHostedZoneId'),
                AliasTarget: {
                    DNSName: cf.getAtt('RestApiDomain', 'DistributionDomainName'),
                    EvaluateTargetHealth: false,
                    HostedZoneId: cf.getAtt('RestApiDomain', 'DistributionHostedZoneId')
                }
            }
        },
        RestApiDeployment: {
            Type: 'AWS::ApiGateway::Deployment',
            Properties: {
                Description: cf.stackName,
                RestApiId: cf.ref('RestApi'),
                StageName: cf.stackName
            }
        },
        RestApiDomain: {
            Type: 'AWS::ApiGateway::DomainName',
            Properties: {
                DomainName: cf.join(['api.', cf.ref('RootDomain')]),
                CertificateArn: cf.join(['arn:', cf.partition, ':acm:', cf.region, ':', cf.accountId, ':certificate/', cf.ref('RootDomainCertificate')]),
            }
        },
        RestApiDomainMap: {
            Type: 'AWS::ApiGateway::BasePathMapping',
            Properties: {
                DomainName: cf.ref('RestApiDomain'),
                RestApiId: cf.ref('RestApi'),
                Stage: cf.stackName
            }
        },
        RestApi: {
            Type: 'AWS::ApiGateway::RestApi',
            Properties: {
                Name: cf.stackName,
                Description: cf.stackName
            },
        },
        RestApiProxyResource: {
            Type: "AWS::ApiGateway::Resource",
            Properties: {
                ParentId: cf.getAtt('RestApi', 'RootResourceId'),
                RestApiId: cf.ref('RestApi'),
                PathPart: '{proxy+}'
            }
        },
        RestApiRootMethod: {
            Type: 'AWS::ApiGateway::Method',
            Properties: {
                AuthorizationType: 'NONE',
                HttpMethod: 'ANY',
                Integration: {
                    IntegrationHttpMethod: 'POST',
                    Type: 'AWS_PROXY',
                    IntegrationResponses: [{
                        StatusCode: 200
                    }],
                    Uri: { 'Fn::Sub': 'arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${RestFunction.Arn}/invocations' }
                },
                ResourceId: cf.ref('RestApiProxyResource'),
                RestApiId: cf.ref('RestApi')
            }
        },
        RestFunctionCaller: {
            Type: 'AWS::Lambda::Permission',
            Properties: {
                Action: 'lambda:InvokeFunction',
                FunctionName: cf.ref('RestFunction'),
                Principal: 'apigateway.amazonaws.com',
                SourceAccount: cf.accountId,
                SourceArn: cf.join(['arn:', cf.partition, ':execute-api:', cf.region, ':', cf.accountId, ':', cf.ref('RestApi'), '/*/*/*'])
            }
        },
        RestFunction: {
            Type: 'AWS::Lambda::Function',
            Properties: {
                Code: {
                    ImageUri: cf.join([cf.accountId, '.dkr.ecr.', cf.region, '.amazonaws.com/sam-service:api-', cf.ref('GitSha')]),
                },
                PackageType: 'Image',
                MemorySize: 1024,
                Role: cf.getAtt('FunctionRole', 'Arn'),
                Timeout: 240,
                Environment: {
                    Variables: {
                        AssetBucket: cf.ref('AssetBucket'),
                        StackName: cf.stackName,
                        GitSha: cf.ref('GitSha'),
                        UserPoolId: cf.ref('UserPool'),
                        ClientId: cf.ref('UserPoolClient'),
                        'FRONTEND_BUCKET': cf.ref('FrontendBucket'),
                    }
                }
            }
        },
        FunctionRole: {
            Type: 'AWS::IAM::Role',
            Properties: {
                AssumeRolePolicyDocument: {
                    Version: '2012-10-17',
                    Statement: [{
                        Action: ['sts:AssumeRole'],
                        Effect: 'Allow',
                        Principal: {
                            Service: ['lambda.amazonaws.com']
                        }
                    }]
                },
                ManagedPolicyArns: [
                    'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
                    'arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole'
                ],
                Policies: [{
                    PolicyName: cf.join([cf.stackName, '-function-policy']),
                    PolicyDocument: {
                        Statement: [{
                            Effect: 'Allow',
                            Action: [
                                'cognito-idp:AdminInitiateAuth',
                                'cognito-idp:AdminRespondToAuthChallenge'
                            ],
                            Resource: [
                                cf.getAtt('UserPool', 'Arn')
                            ]
                        },{
                            Effect: 'Allow',
                            Action: [
                                'ecs:DescribeServices',
                                'ecs:UpdateService'
                            ],
                            Resource: [
                                cf.join(['arn:', cf.partition, ':ecs:', cf.region, ':', cf.accountId, ':cluster/', cf.stackName, '-cluster']),
                                cf.join(['arn:', cf.partition, ':ecs:', cf.region, ':', cf.accountId, ':service/', cf.stackName, '-cluster/', cf.stackName, '-Service']),
                                cf.join(['arn:', cf.partition, ':ecs:', cf.region, ':', cf.accountId, ':service/', cf.stackName, '-cluster/', cf.stackName, '-GPUService']),
                            ]
                        },{
                            Effect: 'Allow',
                            Action: [
                                's3:Get*',
                                's3:List*',
                                's3:Head*'
                            ],
                            Resource: [
                                cf.join(['arn:', cf.partition, ':s3:::', cf.ref('FrontendBucket')]),
                                cf.join(['arn:', cf.partition, ':s3:::', cf.ref('FrontendBucket'), '/*']),
                                cf.join(['arn:', cf.partition, ':s3:::', cf.ref('AssetBucket')]),
                                cf.join(['arn:', cf.partition, ':s3:::', cf.ref('AssetBucket'), '/*'])
                            ]
                        }]
                    }
                }]
            }
        },
    },
    Outputs: {
        RestApi: {
            Description: 'API Gateway endpoint URL for manageing CPU & GPU Stack',
            Value: cf.join(['https://', cf.ref('RestApi'), '.execute-api.', cf.region, '.amazonaws.com/', cf.stackName, '/'])
        },
    }

}
