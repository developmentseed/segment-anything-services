export async function handler(event) {
    console.error(event);

    if (event.httpMethod === 'POST' && event.resource === '/login') {

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
            'Content-Type': 'application/json'
        },
        body
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const res = await handler({
        httpMethod: 'DELETE',
        resource: '/',
        body: {}
    });

    res.body = JSON.parse(res.body);

    console.log(JSON.stringify(res, null, 4));
}
