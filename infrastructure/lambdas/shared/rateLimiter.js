const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const { RateLimitError } = require('./errorHandler');

// Rate limiter configuration
const RATE_LIMIT_TABLE = process.env.RATE_LIMIT_TABLE || process.env.TABLE_NAME;
const DEFAULT_WINDOW = 3600; // 1 hour in seconds
const DEFAULT_MAX_REQUESTS = 1000; // Default requests per window

// Rate limit rules by endpoint and role
const rateLimitRules = {
  // Global limits per role
  global: {
    admin: { windowSeconds: 3600, maxRequests: 10000 },
    seller: { windowSeconds: 3600, maxRequests: 5000 },
    producer: { windowSeconds: 3600, maxRequests: 5000 },
    talent: { windowSeconds: 3600, maxRequests: 2000 },
    client: { windowSeconds: 3600, maxRequests: 1000 },
    anonymous: { windowSeconds: 3600, maxRequests: 100 }
  },
  
  // Endpoint-specific limits
  endpoints: {
    'POST /campaigns': {
      admin: { windowSeconds: 3600, maxRequests: 100 },
      seller: { windowSeconds: 3600, maxRequests: 50 },
      default: { windowSeconds: 3600, maxRequests: 10 }
    },
    'POST /notifications': {
      default: { windowSeconds: 300, maxRequests: 50 } // 50 per 5 minutes
    },
    'GET /analytics': {
      default: { windowSeconds: 60, maxRequests: 10 } // 10 per minute
    },
    'POST /activities': {
      default: { windowSeconds: 60, maxRequests: 100 } // 100 per minute
    }
  }
};

// Rate limiter middleware
function rateLimiter(options = {}) {
  return (handler) => {
    return async (event, context) => {
      const user = event.user;
      const httpMethod = event.httpMethod;
      const path = event.path;
      
      // Skip rate limiting for OPTIONS requests
      if (httpMethod === 'OPTIONS') {
        return handler(event, context);
      }
      
      // Determine rate limit key and rules
      const role = user?.role || 'anonymous';
      const userId = user?.userId || getClientIp(event);
      const endpoint = `${httpMethod} ${path.split('/').slice(0, 3).join('/')}`;
      
      // Get applicable rate limit
      const endpointLimit = rateLimitRules.endpoints[endpoint]?.[role] || 
                           rateLimitRules.endpoints[endpoint]?.default;
      const globalLimit = rateLimitRules.global[role] || rateLimitRules.global.anonymous;
      
      // Check both endpoint and global limits
      const limits = [];
      if (endpointLimit) {
        limits.push({
          key: `RATELIMIT#${endpoint}#${userId}`,
          ...endpointLimit
        });
      }
      limits.push({
        key: `RATELIMIT#GLOBAL#${userId}`,
        ...globalLimit
      });
      
      // Check all applicable limits
      for (const limit of limits) {
        const { allowed, remaining, resetTime } = await checkRateLimit(
          limit.key,
          limit.windowSeconds,
          limit.maxRequests
        );
        
        if (!allowed) {
          throw new RateLimitError(Math.ceil(resetTime - Date.now() / 1000));
        }
        
        // Add rate limit headers to response
        if (!event.rateLimitHeaders) {
          event.rateLimitHeaders = {};
        }
        
        const limitName = limit.key.includes('GLOBAL') ? 'Global' : 'Endpoint';
        event.rateLimitHeaders[`X-RateLimit-${limitName}-Limit`] = limit.maxRequests;
        event.rateLimitHeaders[`X-RateLimit-${limitName}-Remaining`] = remaining;
        event.rateLimitHeaders[`X-RateLimit-${limitName}-Reset`] = resetTime;
      }
      
      // Call the handler
      const response = await handler(event, context);
      
      // Add rate limit headers to response
      if (response.headers && event.rateLimitHeaders) {
        Object.assign(response.headers, event.rateLimitHeaders);
      }
      
      return response;
    };
  };
}

// Check rate limit using sliding window counter
async function checkRateLimit(key, windowSeconds, maxRequests) {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - windowSeconds;
  
  try {
    // Get current window data
    const result = await dynamodb.get({
      TableName: RATE_LIMIT_TABLE,
      Key: {
        PK: key,
        SK: 'METADATA'
      }
    }).promise();
    
    let windowData = result.Item || {
      PK: key,
      SK: 'METADATA',
      requests: [],
      count: 0
    };
    
    // Clean up old requests outside the window
    windowData.requests = (windowData.requests || []).filter(timestamp => timestamp > windowStart);
    windowData.count = windowData.requests.length;
    
    // Check if limit exceeded
    if (windowData.count >= maxRequests) {
      const oldestRequest = Math.min(...windowData.requests);
      const resetTime = oldestRequest + windowSeconds;
      
      return {
        allowed: false,
        remaining: 0,
        resetTime
      };
    }
    
    // Add current request
    windowData.requests.push(now);
    windowData.count++;
    
    // Update counter with TTL
    await dynamodb.put({
      TableName: RATE_LIMIT_TABLE,
      Item: {
        ...windowData,
        updatedAt: now,
        ttl: now + windowSeconds + 3600 // Keep for 1 hour after window expires
      }
    }).promise();
    
    return {
      allowed: true,
      remaining: maxRequests - windowData.count,
      resetTime: now + windowSeconds
    };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Fail open - allow request if rate limiting fails
    return {
      allowed: true,
      remaining: maxRequests,
      resetTime: now + windowSeconds
    };
  }
}

// Get client IP address
function getClientIp(event) {
  return event.headers['X-Forwarded-For']?.split(',')[0] ||
         event.requestContext?.identity?.sourceIp ||
         'unknown';
}

// API key authentication and rate limiting
async function validateApiKey(apiKey) {
  if (!apiKey) {
    return null;
  }
  
  try {
    // Look up API key
    const result = await dynamodb.get({
      TableName: RATE_LIMIT_TABLE,
      Key: {
        PK: `APIKEY#${apiKey}`,
        SK: 'METADATA'
      }
    }).promise();
    
    if (!result.Item || result.Item.status !== 'active') {
      return null;
    }
    
    // Check if expired
    if (result.Item.expiresAt && result.Item.expiresAt < Date.now()) {
      return null;
    }
    
    // Update last used
    await dynamodb.update({
      TableName: RATE_LIMIT_TABLE,
      Key: {
        PK: `APIKEY#${apiKey}`,
        SK: 'METADATA'
      },
      UpdateExpression: 'SET lastUsedAt = :now, usageCount = usageCount + :inc',
      ExpressionAttributeValues: {
        ':now': new Date().toISOString(),
        ':inc': 1
      }
    }).promise();
    
    return {
      apiKeyId: result.Item.apiKeyId,
      name: result.Item.name,
      organizationId: result.Item.organizationId,
      permissions: result.Item.permissions,
      rateLimit: result.Item.rateLimit
    };
  } catch (error) {
    console.error('API key validation failed:', error);
    return null;
  }
}

// IP-based blocking and throttling
async function checkIpBlacklist(ip) {
  try {
    const result = await dynamodb.get({
      TableName: RATE_LIMIT_TABLE,
      Key: {
        PK: `BLACKLIST#IP#${ip}`,
        SK: 'METADATA'
      }
    }).promise();
    
    if (result.Item && result.Item.status === 'blocked') {
      // Check if temporary block has expired
      if (result.Item.expiresAt && result.Item.expiresAt < Date.now()) {
        // Remove expired block
        await dynamodb.delete({
          TableName: RATE_LIMIT_TABLE,
          Key: {
            PK: `BLACKLIST#IP#${ip}`,
            SK: 'METADATA'
          }
        }).promise();
        
        return false;
      }
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('IP blacklist check failed:', error);
    return false;
  }
}

// Automatic blocking for suspicious activity
async function recordSuspiciousActivity(event, reason) {
  const ip = getClientIp(event);
  const userId = event.user?.userId;
  
  const activity = {
    PK: `SUSPICIOUS#${Date.now()}`,
    SK: `${ip}#${userId || 'anonymous'}`,
    timestamp: new Date().toISOString(),
    reason,
    ip,
    userId,
    userAgent: event.headers['User-Agent'],
    path: event.path,
    method: event.httpMethod,
    ttl: Math.floor(Date.now() / 1000) + 86400 * 7 // Keep for 7 days
  };
  
  try {
    await dynamodb.put({
      TableName: RATE_LIMIT_TABLE,
      Item: activity
    }).promise();
    
    // Check if IP should be blocked
    const recentActivities = await dynamodb.query({
      TableName: RATE_LIMIT_TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK > :sk',
      ExpressionAttributeValues: {
        ':pk': `SUSPICIOUS#IP#${ip}`,
        ':sk': new Date(Date.now() - 3600000).toISOString() // Last hour
      },
      Limit: 10
    }).promise();
    
    // Block IP if too many suspicious activities
    if (recentActivities.Count >= 5) {
      await dynamodb.put({
        TableName: RATE_LIMIT_TABLE,
        Item: {
          PK: `BLACKLIST#IP#${ip}`,
          SK: 'METADATA',
          status: 'blocked',
          reason: 'Automated block: Too many suspicious activities',
          blockedAt: new Date().toISOString(),
          expiresAt: Date.now() + 3600000, // Block for 1 hour
          ttl: Math.floor(Date.now() / 1000) + 86400 // Remove after 1 day
        }
      }).promise();
    }
  } catch (error) {
    console.error('Failed to record suspicious activity:', error);
  }
}

// Security headers middleware
function securityHeaders() {
  return (handler) => {
    return async (event, context) => {
      const response = await handler(event, context);
      
      // Add security headers
      const headers = {
        'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.amazonaws.com",
        ...response.headers
      };
      
      return {
        ...response,
        headers
      };
    };
  };
}

// Request validation and sanitization
function validateRequest() {
  return (handler) => {
    return async (event, context) => {
      // Check for suspicious patterns
      const suspiciousPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /\.\.\/|\.\.\\/, // Path traversal
        /union.*select/gi, // SQL injection
        /\';.*--/g, // SQL injection
        /\${.*}/g, // Template injection
        /{{.*}}/g // Template injection
      ];
      
      const checkString = JSON.stringify(event.body || '') + 
                         JSON.stringify(event.queryStringParameters || '') +
                         JSON.stringify(event.pathParameters || '');
      
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(checkString)) {
          await recordSuspiciousActivity(event, `Suspicious pattern detected: ${pattern}`);
          throw new ValidationError('Invalid request data');
        }
      }
      
      // Check request size
      if (event.body && event.body.length > 1048576) { // 1MB limit
        throw new ValidationError('Request body too large');
      }
      
      return handler(event, context);
    };
  };
}

// Compose security middleware
function withSecurity(options = {}) {
  return (handler) => {
    let wrappedHandler = handler;
    
    // Apply middleware in order
    if (options.validateRequest !== false) {
      wrappedHandler = validateRequest()(wrappedHandler);
    }
    
    if (options.rateLimiting !== false) {
      wrappedHandler = rateLimiter(options.rateLimitOptions)(wrappedHandler);
    }
    
    if (options.securityHeaders !== false) {
      wrappedHandler = securityHeaders()(wrappedHandler);
    }
    
    return async (event, context) => {
      // Check IP blacklist
      const ip = getClientIp(event);
      if (await checkIpBlacklist(ip)) {
        return {
          statusCode: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            error: {
              message: 'Access denied',
              type: 'FORBIDDEN'
            }
          })
        };
      }
      
      // Check API key if provided
      const apiKey = event.headers['X-API-Key'];
      if (apiKey) {
        const apiKeyData = await validateApiKey(apiKey);
        if (!apiKeyData) {
          return {
            statusCode: 401,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              error: {
                message: 'Invalid API key',
                type: 'AUTHENTICATION_ERROR'
              }
            })
          };
        }
        
        // Add API key data to event
        event.apiKey = apiKeyData;
      }
      
      return wrappedHandler(event, context);
    };
  };
}

module.exports = {
  rateLimiter,
  validateApiKey,
  checkIpBlacklist,
  recordSuspiciousActivity,
  securityHeaders,
  validateRequest,
  withSecurity,
  rateLimitRules
};