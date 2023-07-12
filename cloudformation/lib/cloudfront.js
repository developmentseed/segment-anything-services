import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        CloudFrontLogS3Bucket: {
            Type: "AWS::S3::Bucket",
            Properties: {
                BucketName: cf.join('-', [cf.stackName, 'logs', cf.accountId, cf.region]),
                OwnershipControls: {
                    Rules: [{
                        ObjectOwnership: 'BucketOwnerPreferred'
                    }]
                },
                PublicAccessBlockConfiguration: {
                    BlockPublicAcls: true,
                    BlockPublicPolicy: true,
                    IgnorePublicAcls: true,
                    RestrictPublicBuckets: true
                }
            }
        },
        CloudFrontAccessIdentity: {
            Type: "AWS::CloudFront::CloudFrontOriginAccessIdentity",
            Properties: {
                CloudFrontOriginAccessIdentityConfig: {
                    Comment: cf.join(['Use to access ', cf.ref('FrontendBucket'), ' bucket'])
                }
            }
        },
        CloudFrontDistribution: {
            Type: "AWS::CloudFront::Distribution",
            Properties: {
                DistributionConfig: {
                    Origins: [{
                        DomainName: cf.getAtt('FrontendBucket', 'DomainName'),
                        OriginPath: cf.join(['/', cf.ref('GitSha')]),
                        Id: "FrontEndOrigin",
                        S3OriginConfig: {
                            OriginAccessIdentity: cf.join(['origin-access-identity/cloudfront/', cf.ref('CloudFrontAccessIdentity')])
                        }
                    }],
                    Enabled: true,
                    Comment: cf.stackName,
                    DefaultRootObject: "index.html",
                    CustomErrorResponses: [{
                        ErrorCode: 403,
                        ResponseCode: 200,
                        ResponsePagePath: "/index.html"
                    },{
                        "ErrorCode": 404,
                        "ResponseCode": 200,
                        "ResponsePagePath": "/index.html"
                    }],
                    Logging: {
                        IncludeCookies: false,
                        Bucket: cf.getAtt("CloudFrontLogS3Bucket", "DomainName"),
                        Prefix: "logs"
                    },
                    DefaultCacheBehavior: {
                        AllowedMethods: [ "GET", "HEAD", "OPTIONS" ],
                        TargetOriginId: "FrontEndOrigin",
                        CachePolicyId: cf.ref('CloudFrontDistributionCachePolicy'),
                        OriginRequestPolicyId: cf.ref('CloudFrontDistributionRequestPolicy'),
                        ResponseHeadersPolicyId: cf.ref('CloudFrontDistributionResponseHeadersPolicy'),
                        ForwardedValues: {
                            QueryString: true,
                            Cookies: { Forward: "none" }
                        },
                        ViewerProtocolPolicy: "redirect-to-https"
                    },
                    ViewerCertificate: {
                        CloudFrontDefaultCertificate: true
                    },
                },
                Tags: [{
                    Key: "name",
                    Value: cf.stackName
                }]
            },
        },
        CloudFrontDistributionCachePolicy: {
            Type: 'AWS::CloudFront::CachePolicy',
            Properties: {
                CachePolicyConfig: {
                    Comment: "Cache policy for SAS Distributions",
                    DefaultTTL: 86400,
                    MaxTTL: 31536000,
                    MinTTL: 86400,
                    Name: cf.join([cf.stackName, "-distribution-CachePolicy"]),
                    ParametersInCacheKeyAndForwardedToOrigin: {
                        CookiesConfig: {
                            CookieBehavior: 'none'
                        },
                        EnableAcceptEncodingGzip: true,
                        QueryStringsConfig: {
                            QueryStringBehavior: 'all'
                        },
                        HeadersConfig: {
                            HeaderBehavior: "whitelist",
                                Headers: [
                                "User-Agent",
                                "Accept-Language",
                                "Access-Control-Request-Headers",
                                "Access-Control-Request-Method",
                                "Origin"
                            ]
                        }
                    }
                }
            }
        },
        CloudFrontDistributionRequestPolicy: {
            Type: 'AWS::CloudFront::OriginRequestPolicy',
            Properties: {
                OriginRequestPolicyConfig: {
                    Comment: "Origin request policy for forwarding headers",
                    Name: cf.join([cf.stackName, "-distribution-ForwardHeadersPolicy"]),
                    QueryStringsConfig: {
                        QueryStringBehavior: 'all'
                    },
                    CookiesConfig: {
                        CookieBehavior: 'none'
                    },
                    HeadersConfig: {
                        HeaderBehavior: "whitelist",
                            Headers: [
                            "User-Agent",
                            "Accept-Language",
                            "Access-Control-Request-Headers",
                            "Access-Control-Request-Method",
                            "Access-Control-Allow-Origin",
                            "Origin"
                        ]
                    }
                },
            }
        },
        CloudFrontDistributionResponseHeadersPolicy: {
            Type: "AWS::CloudFront::ResponseHeadersPolicy",
            Properties: {
                ResponseHeadersPolicyConfig: {
                    Name: cf.join([cf.stackName, "-distribution-RequestHeadersPolicy"]),
                    CorsConfig: {
                        AccessControlAllowCredentials: false,
                        AccessControlAllowHeaders: {
                            Items: ['Access-Control-Allow-Origin', 'Access-Control-Allow-Methods']
                        },
                        AccessControlAllowMethods: {
                            Items: ['GET', 'OPTIONS'],
                        },
                        AccessControlAllowOrigins: {
                            Items: ['*'],
                        },
                        AccessControlExposeHeaders: {
                            Items: ['*']
                        },
                        OriginOverride: false
                    }
                }
            }
        },
    },
    Outputs: {
        CloudfrontDistributionDNS: {
            Description: "Cloudfront DNS to add to Route 53",
            Value: cf.getAtt("CloudFrontDistribution", "DomainName")
        },
    }
};
