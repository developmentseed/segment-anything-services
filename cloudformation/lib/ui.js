import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        RestApiDeployment: {
            Type: 'AWS::ApiGateway::Deployment',
            Properties: {
                Description: cf.stackName,
                RestApiId: cf.ref('RestApi'),
                StageName: cf.stackName
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
                    'x-amazon-apigateway-binary-media-types': ['*/*'],
                    'paths': {
                        '/status': {
                            'options': {
                                'x-amazon-apigateway-integration': {
                                    'type': 'mock',
                                    'requestTemplates': {
                                        'application/json': '{\n  "statusCode" : 200\n}\n'
                                    },
                                    'responses': {
                                        'default': {
                                            'statusCode': '200',
                                            'responseTemplates': {
                                                'application/json': '{}\n'
                                            },
                                            'responseParameters': {
                                                'method.response.header.Access-Control-Allow-Origin': "'*'",
                                                'method.response.header.Access-Control-Allow-Methods': "'GET, POST, OPTIONS'"
                                            }
                                        }
                                    }
                                },
                                'consumes': [
                                    'application/json'
                                ],
                                'summary': 'CORS support',
                                'responses': {
                                    '200': {
                                        'headers': {
                                            'Access-Control-Allow-Origin': {
                                                'type': 'string'
                                            },
                                            'Access-Control-Allow-Methods': {
                                                'type': 'string'
                                            }
                                        },
                                        'description': 'Default response for CORS method'
                                    }
                                },
                                'produces': ['application/json']
                            },
                            'get': {
                                'x-amazon-apigateway-integration': {
                                    'httpMethod': 'POST',
                                    'type': 'aws_proxy',
                                    'uri': {
                                        'Fn::Sub': 'arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${RestFunction.Arn}/invocations'
                                    }
                                },
                                'responses': {}
                            }
                        },
                    },
                },
                Description: cf.stackName,
                BinaryMediaTypes: [ '*/*' ]
            },
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
