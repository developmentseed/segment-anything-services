import Cognito from '@aws-sdk/client-cognito-identity';
import ECS from '@aws-sdk/client-ecs';
import S3 from '@aws-sdk/client-s3';
import CognitoProvider from '@aws-sdk/client-cognito-identity-provider';

for (const env of ['UserPoolId', 'ClientId', 'StackName', 'AssetBucket', 'GitSha']) {
    if (!process.env[env]) throw new Error(`${env} Env Var Required`);
}

export async function handler(event) {
    const cognito = new Cognito.CognitoIdentityClient();
    const provider = new CognitoProvider.CognitoIdentityProvider();

    console.error(JSON.stringify(event));

    if (event.body && event.isBase64Encoded) {
        try {
            event.body = JSON.parse(String(Buffer.from(event.body, 'base64')));
        } catch (err) {
            return response({ message: 'Failed to parse request body' }, 400);
        }
    }

    try {
        if (event.httpMethod === 'OPTIONS') {
            return response({ message: 'Sent It' }, 200);
        } else if (event.httpMethod === 'POST' && event.path === '/login') {
            if (event.body.ChallengeResponse) {
                if (!event.body.ChallengeName) throw new Error('ChallengeName required');
                if (!event.body.Session) throw new Error('Session required');

                const res = await provider.adminRespondToAuthChallenge({
                    UserPoolId: process.env.UserPoolId,
                    ClientId: process.env.ClientId,
                    ChallengeName: event.body.ChallengeName,
                    ChallengeResponses: {
                        USERNAME: event.body.ChallengeResponse.USERNAME,
                        NEW_PASSWORD: event.body.ChallengeResponse.NEW_PASSWORD
                    },
                    Session: event.body.Session
                });

                return response({ message: 'Challenge Accepted' }, 200);
            } else {
                console.error(process.env.UserPoolId, process.env.ClientId);
                const auth = await provider.adminInitiateAuth({
                    UserPoolId: process.env.UserPoolId,
                    ClientId: process.env.ClientId,
                    AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
                    AuthParameters: {
                        USERNAME: event.body.Username,
                        PASSWORD: event.body.Password
                    }
                });

                if (auth.ChallengeName) {
                    return response({
                        ChallengeName: auth.ChallengeName,
                        ChallengeParameters: auth.ChallengeParameters,
                        Session: auth.Session
                    }, 200);
                }

                const user = await provider.getUser({
                    AccessToken: auth.AuthenticationResult.AccessToken
                });

                const attrs = {};
                for (const attr of user.UserAttributes) {
                    attrs[attr.Name] = attr.Value;
                }

                return response({
                    username: user.Username,
                    email: attrs.email,
                    token: auth.AuthenticationResult.AccessToken
                })
            }
        }

        // Auth - All Endpoints past this point require Auth
        if (!event.headers.Authorization) throw new Error('No Authorization Header Provided');

        const user = await provider.getUser({
            AccessToken: event.headers.Authorization.split(' ')[1]
        });

        if (event.httpMethod === 'GET' && event.path === '/login') {
            const attrs = {};
            for (const attr of user.UserAttributes) {
                attrs[attr.Name] = attr.Value;
            }

            return response({
                username: user.Username,
                email: attrs.email
            })
        } else if (event.httpMethod === 'POST' && event.path === '/status') {
            const ecs = new ECS.ECSClient({});

            const cmds = [];
            if (!isNaN(parseInt(event.body.gpu))) {
                cmds.push(ecs.send(new ECS.UpdateServiceCommand({
                    service: process.env.StackName + '-GPUService',
                    cluster: `${process.env.StackName}-cluster`,
                    desiredCount: parseInt(event.body.gpu)
                })));
            }

            if (!isNaN(parseInt(event.body.cpu))) {
                cmds.push(ecs.send(new ECS.UpdateServiceCommand({
                    service: process.env.StackName + '-Service',
                    cluster: `${process.env.StackName}-cluster`,
                    desiredCount: parseInt(event.body.cpu)
                })));
            }

            await Promise.all(cmds);

            return response({
                message: 'Updated Services'
            })

        } else if (event.httpMethod === 'GET' && event.path === '/status') {
            const ecs = new ECS.ECSClient({});
            const s3 = new S3.S3Client({});

            const res = {
                models: [],
                gpu: {},
                cpu: {}
            };

            await Promise.all([
                (async () => {
                    const services = await ecs.send(new ECS.DescribeServicesCommand({
                        cluster: `${process.env.StackName}-cluster`,
                        services: [
                            `${process.env.StackName}-Service`,
                            `${process.env.StackName}-GPUService`,
                        ]
                    }));

                    for (const service of services.services) {
                        const type = service.serviceName.endsWith('GPUService') ? 'gpu' : 'cpu';

                        res[type].pending = service.pendingCount;
                        res[type].running = service.runningCount;
                        res[type].desired = service.desiredCount;
                    }
                })(),
                (async () => {
                    const list = await s3.send(new S3.ListObjectsCommand({
                        Bucket: process.env.AssetBucket,
                        Prefix: process.env.GitSha
                    }));

                    res.models = (list.Contents || []).map((key) => {
                        return key.Key.replace(process.env.GitSha + '/', '')
                    });
                })()
            ]);

            console.error(res);

            return response(res);
        } else {
            return response({ message: 'Unimplemented Method' }, 404);
        }

    } catch (err) {
        console.error(err);
        return response({ message: err.message }, 400);
    }

}

function response(body, statusCode=200) {
    if (body instanceof Error) {
        body = JSON.stringify({ message: body.message });
    } else if (typeof body === 'object') {
        body = JSON.stringify(body);
    }

    return {
        statusCode,
        isBase64Encoded: false,
        headers: {
            'Content-Type': 'application/json',
            "Access-Control-Allow-Headers" : "Content-Type,Authorization,Content-Length",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
        },
        body
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const res = await handler({
        httpMethod: 'POST',
        path: '/login',
        body: {
            Username: 'ingalls',
            Password: process.env.PASSWORD
        }
    });

    const res2 = await handler({
        httpMethod: 'GET',
        path: '/status',
        headers: {
            Authorization: `Bearer ${JSON.parse(res.body).token}`
        }
    });
}
