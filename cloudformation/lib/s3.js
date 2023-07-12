import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        FrontendBucket: {
            Type: 'AWS::S3::Bucket',
            Properties: {
                BucketName: cf.join('-', [cf.stackName, 'frontend', cf.accountId, cf.region]),
                PublicAccessBlockConfiguration: {
                    BlockPublicAcls: true,
                    BlockPublicPolicy: true,
                    IgnorePublicAcls: true,
                    RestrictPublicBuckets: true
                },
                WebsiteConfiguration: {
                    ErrorDocument: 'index.html',
                    IndexDocument: 'index.html'
                }
            }
        },
        FrontendBucketPolicy: {
            DependsOn: "FrontendBucket",
            Type: "AWS::S3::BucketPolicy",
            Properties: {
                Bucket: cf.ref('FrontendBucket'),
                PolicyDocument: {
                    Version: "2012-10-17",
                    Statement: [{
                        Action: [ "s3:GetObject" ],
                        Effect: "Allow",
                        Resource: cf.join([cf.getAtt('FrontendBucket', 'Arn'), '/*']),
                        Principal: {
                            AWS: cf.join(['arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity ', cf.getAtt('CloudFrontAccessIdentity', 'Id')])
                        }
                    }]
                }
            },
        },
        AssetBucket: {
            Type: 'AWS::S3::Bucket',
            Properties: {
                BucketName: cf.join('-', [cf.stackName, cf.accountId, cf.region])
            }
        }
    }
};
