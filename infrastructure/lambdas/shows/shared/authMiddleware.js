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

// Role-permission mappings
const ROLE_PERMISSIONS = {
  admin: [
    'users.manage',
    'users.delete',
    'shows.manage',
    'episodes.manage',
    'campaigns.manage',
    'billing.manage',
    'reports.full',
    'settings.organization',
    'approvals.manage',
    'analytics.full'
  ],
  seller: [
    'campaigns.create',
    'campaigns.view.own',
    'campaigns.edit.own',
    'clients.manage',
    'billing.view',
    'reports.sales',
    'approvals.submit',
    'pipeline.manage',
    'deals.manage'
  ],
  producer: [
    'shows.view.assigned',
    'shows.edit.assigned',
    'episodes.create',
    'episodes.edit.assigned',
    'approvals.review',
    'approvals.submit',
    'reports.performance',
    'analytics.shows'
  ],
  talent: [
    'episodes.view.assigned',
    'recordings.manage',
    'schedule.view',
    'availability.manage',
    'approvals.view.assigned'
  ],
  client: [
    'campaigns.view.own',
    'billing.view',
    'reports.campaigns',
    'analytics.campaigns'
  ]
};

// Verify JWT token
async function verifyToken(token) {
  try {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded) {
      throw new Error('Invalid token');
    }

    const key = await getKey(decoded.header.kid);
    const publicKey = key.getPublicKey();
    
    const verified = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${USER_POOL_ID}`,
      audience: decoded.payload.aud
    });

    return verified;
  } catch (error) {
    console.error('Token verification failed:', error);
    throw new Error('Invalid or expired token');
  }
}

// Extract user info from token
function getUserFromToken(token) {
  const claims = jwt.decode(token);
  if (!claims) {
    throw new Error('Invalid token');
  }

  return {
    id: claims.sub,
    email: claims.email || claims['cognito:username'],
    role: claims['custom:role'] || 'client',
    name: claims.name,
    permissions: ROLE_PERMISSIONS[claims['custom:role'] || 'client'] || []
  };
}

// Check if user has required permission
function hasPermission(user, permission) {
  return user.permissions.includes(permission);
}

// Check if user has any of the required permissions
function hasAnyPermission(user, permissions) {
  return permissions.some(permission => user.permissions.includes(permission));
}

// Check if user has all of the required permissions
function hasAllPermissions(user, permissions) {
  return permissions.every(permission => user.permissions.includes(permission));
}

// Middleware wrapper for Lambda functions
function requireAuth(handler, options = {}) {
  const { permissions = [], requireAll = false } = options;

  return async (event, context) => {
    try {
      // Extract token from Authorization header
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return {
          statusCode: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ 
            message: 'Unauthorized: No token provided' 
          })
        };
      }

      const token = authHeader.substring(7);

      // Verify token
      await verifyToken(token);

      // Get user from token
      const user = getUserFromToken(token);

      // Check permissions if required
      if (permissions.length > 0) {
        const hasRequiredPermissions = requireAll 
          ? hasAllPermissions(user, permissions)
          : hasAnyPermission(user, permissions);

        if (!hasRequiredPermissions) {
          return {
            statusCode: 403,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
              message: 'Forbidden: Insufficient permissions' 
            })
          };
        }
      }

      // Add user to event context
      event.user = user;

      // Call the handler
      return await handler(event, context);

    } catch (error) {
      console.error('Authentication error:', error);
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          message: 'Unauthorized: Invalid token' 
        })
      };
    }
  };
}

// Role-based middleware shortcuts
const requireAdmin = (handler) => requireAuth(handler, { permissions: ['users.manage'], requireAll: true });
const requireSeller = (handler) => requireAuth(handler, { permissions: ['campaigns.create'], requireAll: false });
const requireProducer = (handler) => requireAuth(handler, { permissions: ['shows.edit.assigned'], requireAll: false });
const requireTalent = (handler) => requireAuth(handler, { permissions: ['recordings.manage'], requireAll: false });
const requireClient = (handler) => requireAuth(handler, { permissions: ['campaigns.view.own'], requireAll: false });

module.exports = {
  verifyToken,
  getUserFromToken,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  requireAuth,
  requireAdmin,
  requireSeller,
  requireProducer,
  requireTalent,
  requireClient,
  ROLE_PERMISSIONS
};