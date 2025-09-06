const FinancialService = require('./financialService');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

const financialService = new FinancialService();

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: ''
    };
  }

  try {
    const { httpMethod, queryStringParameters, body, pathParameters } = event;
    const path = event.path || event.resource;

    let result;

    switch (httpMethod) {
      case 'GET':
        if (path.includes('/transactions')) {
          result = await financialService.getTransactions(queryStringParameters);
        } else if (path.includes('/invoices')) {
          if (pathParameters?.id) {
            result = await financialService.getInvoice(pathParameters.id);
          } else {
            result = await financialService.getInvoices(queryStringParameters);
          }
        } else if (path.includes('/payments')) {
          result = await financialService.getPayments(queryStringParameters);
        } else if (path.includes('/cashflow')) {
          result = await financialService.getCashFlow(queryStringParameters);
        } else if (path.includes('/reports')) {
          const reportType = queryStringParameters?.type || 'monthly';
          result = await financialService.generateReport(reportType, queryStringParameters);
        } else {
          result = await financialService.getFinancialSummary(queryStringParameters?.dateRange);
        }
        break;

      case 'POST':
        const postData = JSON.parse(body);
        
        if (path.includes('/transactions')) {
          result = await financialService.createTransaction(postData);
        } else if (path.includes('/invoices')) {
          if (path.includes('/send')) {
            result = await financialService.sendInvoice(pathParameters.id);
          } else {
            result = await financialService.createInvoice(postData);
          }
        } else if (path.includes('/payments')) {
          result = await financialService.recordPayment(postData);
        } else if (path.includes('/reports/generate')) {
          result = await financialService.generateReport(postData.type, postData.params);
        }
        break;

      case 'PUT':
        const putData = JSON.parse(body);
        
        if (path.includes('/invoices')) {
          const invoiceId = pathParameters?.id || putData.invoiceId;
          result = await financialService.updateInvoice(invoiceId, putData);
        } else if (path.includes('/transactions')) {
          const transactionId = pathParameters?.id || putData.transactionId;
          result = await financialService.updateTransaction(transactionId, putData);
        }
        break;

      case 'DELETE':
        if (path.includes('/invoices') && pathParameters?.id) {
          result = await financialService.deleteInvoice(pathParameters.id);
        } else if (path.includes('/transactions') && pathParameters?.id) {
          result = await financialService.deleteTransaction(pathParameters.id);
        }
        break;

      default:
        return {
          statusCode: 405,
          headers: CORS_HEADERS,
          body: JSON.stringify({ message: 'Method not allowed' })
        };
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Error:', error);
    
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal server error';
    
    return {
      statusCode,
      headers: CORS_HEADERS,
      body: JSON.stringify({ 
        message,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};
