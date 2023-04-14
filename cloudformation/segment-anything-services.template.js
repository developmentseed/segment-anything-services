import cf from '@openaddresses/cloudfriend';
import API from './lib/api.js';
import {
    ELB as ELBAlarms,
} from '@openaddresses/batch-alarms';

export default cf.merge(
    API,
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
        }
    },
    ELBAlarms({
        prefix: 'Batch',
        email: cf.ref('AlarmEmail'),
        apache: cf.stackName,
        cluster: cf.ref('ECSCluster'),
        service: cf.getAtt('Service', 'Name'),
        loadbalancer: cf.getAtt('ELB', 'LoadBalancerFullName'),
        targetgroup: cf.getAtt('TargetGroup', 'TargetGroupFullName')

    })
);
