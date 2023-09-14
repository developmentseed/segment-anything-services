import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        UserPool: {
            Type: 'AWS::Cognito::UserPool',
            Properties: {
                UsernameConfiguration: {
                    CaseSensitive: false
                },
                AutoVerifiedAttributes: [ 'email' ],
                UserPoolName: cf.stackName,
                Schema: [{
                    Name: 'email',
                    AttributeDataType: 'String',
                    Mutable: false,
                    Required: true
                }]
            }
        },
        UserPoolClient: {
            Type: 'AWS::Cognito::UserPoolClient',
            Properties: {
                UserPoolId: cf.ref('UserPool'),
                SupportedIdentityProviders: [ 'COGNITO' ],
                ExplicitAuthFlows: [
                    'ALLOW_REFRESH_TOKEN_AUTH',
                    'ALLOW_ADMIN_USER_PASSWORD_AUTH'
                ]
            }
        },
        UserPoolDomain: {
            Type: 'AWS::Cognito::UserPoolDomain',
            Properties: {
                Domain: cf.stackName,
                UserPoolId: cf.ref('UserPool'),
            }
        }
    },
    Outputs: {
        CognitoAdmin: {
            Value: cf.sub('https://${AWS::StackName}.auth.${AWS::Region}.amazoncognito.com/login?client_id=${UserPoolClient}&response_type=code&scope=email+openid+phone+profile&redirect_uri=http://localhost:3000'),
            Description: 'Cognito Admin UI'
        }
    }
}
