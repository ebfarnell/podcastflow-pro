const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const { v4: uuidv4 } = require('uuid');

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME;

exports.handler = async (event) => {
    const { httpMethod, path, body, headers, pathParameters } = event;
    
    try {
        switch (httpMethod) {
            case 'GET':
                if (pathParameters?.id) {
                    return await getInvoice(pathParameters.id);
                }
                return await listInvoices();
            case 'POST':
                if (path.includes('/pay')) {
                    return await processPayment(pathParameters.id, JSON.parse(body));
                }
                return await createInvoice(JSON.parse(body));
            default:
                return {
                    statusCode: 405,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'Method not allowed' })
                };
        }
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

async function listInvoices() {
    const params = {
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
            ':pk': 'INVOICES'
        }
    };
    
    const result = await dynamodb.query(params).promise();
    
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoices: result.Items || [] })
    };
}

async function getInvoice(invoiceId) {
    const params = {
        TableName: TABLE_NAME,
        Key: {
            PK: `INVOICE#${invoiceId}`,
            SK: 'METADATA'
        }
    };
    
    const result = await dynamodb.get(params).promise();
    
    return {
        statusCode: result.Item ? 200 : 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.Item || { error: 'Invoice not found' })
    };
}

async function createInvoice(data) {
    const invoiceId = uuidv4();
    const invoice = {
        PK: `INVOICE#${invoiceId}`,
        SK: 'METADATA',
        GSI1PK: 'INVOICES',
        GSI1SK: new Date().toISOString(),
        id: invoiceId,
        ...data,
        status: 'draft',
        createdAt: new Date().toISOString()
    };
    
    await dynamodb.put({
        TableName: TABLE_NAME,
        Item: invoice
    }).promise();
    
    return {
        statusCode: 201,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoice)
    };
}

async function processPayment(invoiceId, paymentData) {
    // In production, integrate with Stripe
    const params = {
        TableName: TABLE_NAME,
        Key: {
            PK: `INVOICE#${invoiceId}`,
            SK: 'METADATA'
        },
        UpdateExpression: 'SET #status = :status, paidAt = :paidAt',
        ExpressionAttributeNames: {
            '#status': 'status'
        },
        ExpressionAttributeValues: {
            ':status': 'paid',
            ':paidAt': new Date().toISOString()
        }
    };
    
    await dynamodb.update(params).promise();
    
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, invoiceId })
    };
}
