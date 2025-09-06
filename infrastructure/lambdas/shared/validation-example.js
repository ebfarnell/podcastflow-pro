const { requireAuth } = require('./authMiddleware');
const { validateRequest, validateQueryParams, schemas, sanitizeInput } = require('./validation');

// Example of using validation in a Lambda function

// 1. Basic handler with request body validation
const createCampaignHandler = async (event, context) => {
  // At this point, event.body has been validated and parsed
  const campaignData = event.body;
  
  // Sanitize the input data
  const sanitizedData = sanitizeInput(campaignData);
  
  // Your business logic here
  console.log('Creating campaign with validated data:', sanitizedData);
  
  return {
    statusCode: 201,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      message: 'Campaign created successfully',
      data: sanitizedData
    })
  };
};

// 2. Handler with query parameter validation
const listCampaignsHandler = async (event, context) => {
  // Query parameters have been validated
  const { limit, offset, startDate, endDate } = event.queryStringParameters || {};
  
  console.log('Listing campaigns with params:', { limit, offset, startDate, endDate });
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      campaigns: [],
      pagination: { limit, offset }
    })
  };
};

// 3. Compose validation with authentication
const createCampaignWithAuth = requireAuth(
  validateRequest(schemas.campaignCreate)(createCampaignHandler)
);

// 4. Multiple validations
const listCampaignsWithValidation = validateQueryParams(
  schemas.pagination.merge(schemas.dateRange)
)(listCampaignsHandler);

// 5. Custom validation schema
const customSchema = schemas.z.object({
  customField: schemas.z.string().min(5).max(50),
  amount: schemas.z.number().positive(),
  tags: schemas.z.array(schemas.z.string()).min(1).max(5),
  metadata: schemas.z.record(schemas.z.any()).optional()
});

const customHandler = validateRequest(customSchema)(async (event, context) => {
  const data = event.body;
  // Process validated custom data
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({ success: true, data })
  };
});

// 6. Main handler that routes to appropriate validated handlers
exports.handler = async (event, context) => {
  const { httpMethod, pathParameters } = event;
  
  // Handle OPTIONS for CORS
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
      },
      body: ''
    };
  }
  
  try {
    switch (httpMethod) {
      case 'GET':
        if (pathParameters?.id) {
          // Get single item - validate ID parameter
          const validatedEvent = {
            ...event,
            pathParameters: await schemas.id.parseAsync(pathParameters.id)
          };
          return await getSingleItemHandler(validatedEvent, context);
        } else {
          // List items with query validation
          return await listCampaignsWithValidation(event, context);
        }
        
      case 'POST':
        // Create with validation and auth
        return await createCampaignWithAuth(event, context);
        
      case 'PUT':
        // Update with validation
        if (!pathParameters?.id) {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: 'Missing campaign ID' })
          };
        }
        
        // Validate update data
        const updateHandler = validateRequest(schemas.campaignUpdate)(async (event, context) => {
          const { id } = event.pathParameters;
          const updateData = event.body;
          
          // Update logic here
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: 'Updated successfully', id, data: updateData })
          };
        });
        
        return await requireAuth(updateHandler)(event, context);
        
      case 'DELETE':
        // Simple delete with auth
        return await requireAuth(async (event, context) => {
          const { id } = event.pathParameters;
          
          if (!id) {
            return {
              statusCode: 400,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
              body: JSON.stringify({ message: 'Missing ID' })
            };
          }
          
          // Delete logic here
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: 'Deleted successfully', id })
          };
        })(event, context);
        
      default:
        return {
          statusCode: 405,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ message: 'Method not allowed' })
        };
    }
  } catch (error) {
    console.error('Handler error:', error);
    
    // Error is already formatted if it's from validation
    if (error.statusCode) {
      return error;
    }
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ 
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  }
};

// Example of a simple handler without the main router
async function getSingleItemHandler(event, context) {
  const { id } = event.pathParameters;
  
  // Fetch item logic
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ 
      id,
      name: 'Example Campaign',
      createdAt: new Date().toISOString()
    })
  };
}

module.exports = {
  handler: exports.handler,
  // Export individual handlers for testing
  createCampaignHandler: createCampaignWithAuth,
  listCampaignsHandler: listCampaignsWithValidation,
  customHandler
};