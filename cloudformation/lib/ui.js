import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        RestApiDeployment: {
            Type: 'AWS::ApiGateway::Deployment',
            Properties: {
                Description: cf.stackName,
                RestApiId: cf.ref('KelpDataRestApi'),
                StageName: cf.stackName
            }
        },
    },
    KelpDataRestApi: {
        Type: 'AWS::ApiGateway::RestApi',
        Properties: {
            'Body': {
                'swagger': '2.0',
                'info': {
                    'version': '1.0',
                    'title': cf.stackName
                },
                'x-amazon-apigateway-binary-media-types': ['*/*']
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
                                    'Fn::Sub': 'arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${KelpAggregateFunction.Arn}/invocations'
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
        KelpAggregateFunction: {
            Type: 'AWS::Lambda::Function',
            Properties: {
                Code: {
                    ImageUri: cf.join([cf.accountId, '.dkr.ecr.', cf.region, '.amazonaws.com/sam-service:api-', cf.ref('GitSha')]),
                },
                PackageType: 'Image',
                MemorySize: 1024,
                Role: cf.getAtt('KelpAggregateFunctionRole', 'Arn'),
                Timeout: 240,
                Environment: {
                    Variables: {
                        'SHP2JSON_URL': cf.ref('Shp2JsonUrl'),
                        'ZARR_BUCKET': cf.ref('DataBucketProduction')
                    }
                }
            }
        }
    }
}
