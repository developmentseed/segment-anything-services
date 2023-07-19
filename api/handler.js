import Cognito from '@aws-sdk/client-cognito-identity';
import CognitoProvider from '@aws-sdk/client-cognito-identity-provider';

for (const env of ['UserPoolId', 'ClientId']) {
    if (!process.env[env]) throw new Error(`${env} Env Var Required`);
}

export async function handler(event) {
    const cognito = new Cognito.CognitoIdentityClient();

    console.error(JSON.stringify(event));

    if (event.body && event.isBase64Encoded) {
        try {
            event.body = JSON.parse(String(Buffer.from(event.body, 'base64')));
        } catch (err) {
            return response({ message: 'Failed to parse request body' }, 400);
        }
    }

    if (event.httpMethod === 'OPTIONS') {
        return response({ message: 'Sent It' }, 200);
    } else if (event.httpMethod === 'POST' && event.path === '/login') {
        const provider = new CognitoProvider.CognitoIdentityProvider();

        try {
            if (event.body.ChallengeResponse) {
                if (!event.body.ChallengeName) throw new Error('ChallengeName required');
                if (!event.body.Session) throw new Error('Session required');

                const res = await provider.adminRespondToAuthChallenge({
                    UserPoolId: process.env.UserPoolId,
                    ClientId: process.env.ClientId,
                    ChallengeName: event.body.ChallengeName,
                    ChallengeResponses: {
                        ...event.body.ChallengeResponse
                    },
                    Session: event.body.Session
                });

                return response({ message: 'Challenge Accepted' }, 200);
            } else {
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
        } catch (err) {
            console.error(err);
            return response({ message: err.message }, 400);
        }
    } else {
        return response({ message: 'Unimplemented Method' }, 404);
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
            "Access-Control-Allow-Headers" : "Content-Type",
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

    console.error(res.body);
}
