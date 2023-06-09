import cf from '@openaddresses/cloudfriend';
import API from './lib/api.js';
import GPU from './lib/gpu.js';
import S3 from './lib/s3.js';
import Shared from './lib/shared.js';
import {
    ELB as ELBAlarms
} from '@openaddresses/batch-alarms';

export default cf.merge(
    S3,
    Shared,
    API,
    GPU,
    {
        Description: 'Template for @developmentseed/segment-anything-geo',
        Parameters: {
            GitSha: {
                Description: 'GitSha that is currently being deployed',
                Type: 'String'
            },
            SSLCertificateIdentifier: {
                Description: 'ACM SSL Certificate for HTTP Protocol',
                Type: 'String'
            },
            AlarmEmail: {
                Description: 'Email to send alarms to',
                Type: 'String'
            },
            VpcId: {
                Type: 'String'
            },
            PublicSubnetA: {
                Type: 'String'
            },
            PublicSubnetB: {
                Type: 'String'
            }

        }
    },
    ELBAlarms({
        prefix: 'CPU',
        email: cf.ref('AlarmEmail'),
        apache: cf.stackName,
        cluster: cf.ref('ECSCluster'),
        service: cf.getAtt('Service', 'Name'),
        loadbalancer: cf.getAtt('ELB', 'LoadBalancerFullName'),
        targetgroup: cf.getAtt('TargetGroup', 'TargetGroupFullName')

    }),
    ELBAlarms({
        prefix: 'GPU',
        email: cf.ref('AlarmEmail'),
        apache: cf.stackName,
        cluster: cf.ref('ECSCluster'),
        service: cf.getAtt('GPUService', 'Name'),
        loadbalancer: cf.getAtt('GPUELB', 'LoadBalancerFullName'),
        targetgroup: cf.getAtt('GPUTargetGroup', 'TargetGroupFullName')

    })
);
