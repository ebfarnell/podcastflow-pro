const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const { promisify } = require('util');

// Constants
const COGNITO_REGION = process.env.AWS_REGION || 'us-east-1';
const USER_POOL_ID = process.env.USER_POOL_ID;
const JWKS_URI = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`;

// JWKS client for verifying JWT tokens
const client = jwksClient({
  jwksUri: JWKS_URI,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 600000 // 10 minutes
});

const getKey = promisify(client.getSigningKey);

// Generate IAM policy
function generatePolicy(principalId, effect, resource, context) {
  const authResponse = {
    principalId
  };

  if (effect && resource) {
    authResponse.policyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource
        }
      ]
    };
  }

  // Add context for downstream Lambda functions
  if (context) {
    authResponse.context = context;
  }

  return authResponse;
}

exports.handler = async (event) => {
  console.log('Authorizer event:', JSON.stringify(event, null, 2));

  try {
    const token = event.authorizationToken?.replace('Bearer ', '');
    
    if (!token) {
      throw new Error('Unauthorized');
    }

    // Decode token to get header
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded) {
      throw new Error('Invalid token');
    }

    // Get signing key from JWKS
    const key = await getKey(decoded.header.kid);
    const publicKey = key.getPublicKey();

    // Verify token
    const verified = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${USER_POOL_ID}`,
      audience: decoded.payload.aud
    });

    // Extract user information
    const userId = verified.sub;
    const email = verified.email || verified['cognito:username'];
    const role = verified['custom:role'] || 'client';
    const organizationId = verified['custom:organizationId'] || 'default';

    // Create context for downstream services
    const context = {
      userId,
      email,
      role,
      organizationId,
      tokenIssuer: verified.iss,
      tokenAudience: verified.aud
    };

    // Generate allow policy
    return generatePolicy(userId, 'Allow', event.methodArn, context);

  } catch (error) {
    console.error('Authorization error:', error);
    
    // Return explicit unauthorized error
    throw new Error('Unauthorized');
  }
};