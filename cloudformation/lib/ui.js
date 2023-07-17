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
                'Body': {
                    'swagger': '2.0',
                    'info': {
                        'version': '1.0',
                        'title': cf.stackName
                    },
                    'paths': {
                        '/login': {
                            'options': {
                                'x-amazon-apigateway-integration': {
                                    'httpMethod': 'OPTIONS',
                                    'type': 'aws_proxy',
                                    'uri': { 'Fn::Sub': 'arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${RestFunction.Arn}/invocations' }
                                },
                            },
                            'post': {
                                'x-amazon-apigateway-integration': {
                                    'httpMethod': 'POST',
                                    'type': 'aws_proxy',
                                    'uri': { 'Fn::Sub': 'arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${RestFunction.Arn}/invocations' }
                                },
                            }
                        },
                    },
                },
                Description: cf.stackName
            },
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
                                's3:Get*',
                                's3:List*',
                                's3:Head*'
                            ],
                            Resource: [
                                cf.join(['arn:aws:s3:::', cf.ref('FrontendBucket')]),
                                cf.join(['arn:aws:s3:::', cf.ref('FrontendBucket'), '/*'])
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
