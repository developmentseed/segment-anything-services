import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        FrontendBucket: {
            Type: 'AWS::S3::Bucket',
            Properties: {
                BucketName: cf.join('-', [cf.stackName, 'frontend', cf.accountId, cf.region])
            }
        },
        AssetBucket: {
            Type: 'AWS::S3::Bucket',
            Properties: {
                BucketName: cf.join('-', [cf.stackName, cf.accountId, cf.region])
            }
        }
    }
};
