const { ZodError, z } = require('zod');

// Common validation schemas
const schemas = {
  // User schemas
  userCreate: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
    role: z.enum(['admin', 'seller', 'producer', 'talent', 'client'], {
      errorMap: () => ({ message: 'Invalid role' })
    }),
    organizationId: z.string().optional(),
    phone: z.string().optional(),
  }),

  userUpdate: z.object({
    name: z.string().min(1).max(100).optional(),
    phone: z.string().optional(),
    avatar: z.string().url().optional(),
    bio: z.string().max(500).optional(),
    preferences: z.object({
      emailNotifications: z.boolean().optional(),
      smsNotifications: z.boolean().optional(),
      timezone: z.string().optional(),
    }).optional(),
  }),

  // Campaign schemas
  campaignCreate: z.object({
    name: z.string().min(1, 'Campaign name is required').max(200),
    client: z.string().min(1, 'Client is required'),
    agency: z.string().optional(),
    description: z.string().max(1000).optional(),
    status: z.enum(['draft', 'active', 'paused', 'completed', 'cancelled']).optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    budget: z.number().min(0, 'Budget must be positive').optional(),
    targetImpressions: z.number().min(0).optional(),
    industry: z.string().optional(),
    targetAudience: z.string().optional(),
    accountTeam: z.array(z.object({
      userId: z.string(),
      teamRole: z.enum(['account_manager', 'creative_director', 'media_planner', 'analyst']),
      permissions: z.array(z.string()).optional(),
    })).optional(),
  }),

  campaignUpdate: z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional(),
    status: z.enum(['draft', 'active', 'paused', 'completed', 'cancelled']).optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    budget: z.number().min(0).optional(),
    targetImpressions: z.number().min(0).optional(),
    targetAudience: z.string().optional(),
  }),

  // Show schemas
  showCreate: z.object({
    name: z.string().min(1, 'Show name is required').max(200),
    description: z.string().max(1000).optional(),
    network: z.string().optional(),
    genre: z.string().optional(),
    format: z.enum(['audio', 'video', 'both']).optional(),
    frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly']).optional(),
    averageListeners: z.number().min(0).optional(),
    demographics: z.object({
      ageRange: z.string().optional(),
      gender: z.string().optional(),
      interests: z.array(z.string()).optional(),
    }).optional(),
    producerId: z.string().optional(),
    talentIds: z.array(z.string()).optional(),
  }),

  showUpdate: z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional(),
    network: z.string().optional(),
    genre: z.string().optional(),
    format: z.enum(['audio', 'video', 'both']).optional(),
    frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly']).optional(),
    averageListeners: z.number().min(0).optional(),
    demographics: z.object({
      ageRange: z.string().optional(),
      gender: z.string().optional(),
      interests: z.array(z.string()).optional(),
    }).optional(),
  }),

  // Episode schemas
  episodeCreate: z.object({
    showId: z.string().min(1, 'Show ID is required'),
    title: z.string().min(1, 'Episode title is required').max(300),
    description: z.string().max(2000).optional(),
    episodeNumber: z.number().int().min(1).optional(),
    seasonNumber: z.number().int().min(1).optional(),
    airDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
    duration: z.number().min(0, 'Duration must be positive').optional(),
    status: z.enum(['draft', 'scheduled', 'recording', 'editing', 'published']).optional(),
    talentId: z.string().optional(),
    adSlots: z.array(z.object({
      position: z.enum(['pre-roll', 'mid-roll', 'post-roll']),
      duration: z.number().min(0),
      price: z.number().min(0).optional(),
      available: z.boolean().optional(),
    })).optional(),
  }),

  episodeUpdate: z.object({
    title: z.string().min(1).max(300).optional(),
    description: z.string().max(2000).optional(),
    episodeNumber: z.number().int().min(1).optional(),
    seasonNumber: z.number().int().min(1).optional(),
    airDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    duration: z.number().min(0).optional(),
    status: z.enum(['draft', 'scheduled', 'recording', 'editing', 'published']).optional(),
    adSlots: z.array(z.object({
      position: z.enum(['pre-roll', 'mid-roll', 'post-roll']),
      duration: z.number().min(0),
      price: z.number().min(0).optional(),
      available: z.boolean().optional(),
    })).optional(),
  }),

  // Client schemas
  clientCreate: z.object({
    name: z.string().min(1, 'Client name is required').max(200),
    industry: z.string().min(1, 'Industry is required'),
    contactName: z.string().min(1, 'Contact name is required'),
    contactEmail: z.string().email('Invalid email format'),
    contactPhone: z.string().optional(),
    website: z.string().url().optional(),
    address: z.object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zipCode: z.string().optional(),
      country: z.string().optional(),
    }).optional(),
    assignedSeller: z.string().optional(),
    notes: z.string().max(1000).optional(),
  }),

  clientUpdate: z.object({
    name: z.string().min(1).max(200).optional(),
    industry: z.string().optional(),
    contactName: z.string().optional(),
    contactEmail: z.string().email().optional(),
    contactPhone: z.string().optional(),
    website: z.string().url().optional(),
    address: z.object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zipCode: z.string().optional(),
      country: z.string().optional(),
    }).optional(),
    assignedSeller: z.string().optional(),
    notes: z.string().max(1000).optional(),
  }),

  // Notification schemas
  notificationCreate: z.object({
    recipientId: z.string().min(1, 'Recipient ID is required'),
    type: z.string().min(1, 'Notification type is required'),
    title: z.string().min(1, 'Title is required').max(200),
    message: z.string().min(1, 'Message is required').max(1000),
    priority: z.enum(['low', 'normal', 'medium', 'high']).optional(),
    data: z.record(z.any()).optional(),
    sendEmail: z.boolean().optional(),
  }),

  // Activity log schemas
  activityLog: z.object({
    type: z.string().min(1, 'Activity type is required'),
    action: z.string().min(1, 'Action is required'),
    entityType: z.string().optional(),
    entityId: z.string().optional(),
    entityName: z.string().optional(),
    details: z.record(z.any()).optional(),
    previousValue: z.any().optional(),
    newValue: z.any().optional(),
    actorId: z.string().optional(),
    actorName: z.string().optional(),
    actorRole: z.string().optional(),
    ip: z.string().optional(),
  }),

  // Team member schemas
  teamMemberAdd: z.object({
    userId: z.string().min(1, 'User ID is required'),
    teamRole: z.enum(['account_manager', 'creative_director', 'media_planner', 'analyst'], {
      errorMap: () => ({ message: 'Invalid team role' })
    }),
    permissions: z.array(z.string()).optional(),
  }),

  // Common ID validation
  id: z.string().min(1, 'ID is required'),
  
  // Pagination
  pagination: z.object({
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional(),
    nextToken: z.string().optional(),
  }),

  // Date range
  dateRange: z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }).refine(
    data => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
      }
      return true;
    },
    { message: 'Start date must be before or equal to end date' }
  ),
};

// Validation middleware
function validateRequest(schema) {
  return (handler) => {
    return async (event, context) => {
      try {
        // Parse body if it's a string
        let data = event.body;
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data);
          } catch (e) {
            return {
              statusCode: 400,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                message: 'Invalid JSON in request body',
                error: e.message
              })
            };
          }
        }

        // Validate data against schema
        const validatedData = await schema.parseAsync(data);
        
        // Replace event body with validated data
        event.body = validatedData;
        
        // Call the handler
        return await handler(event, context);
      } catch (error) {
        console.error('Validation error:', error);
        
        if (error instanceof ZodError) {
          return {
            statusCode: 400,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              message: 'Validation failed',
              errors: error.errors.map(err => ({
                field: err.path.join('.'),
                message: err.message
              }))
            })
          };
        }
        
        // Re-throw non-validation errors
        throw error;
      }
    };
  };
}

// Validate query parameters
function validateQueryParams(schema) {
  return (handler) => {
    return async (event, context) => {
      try {
        const params = event.queryStringParameters || {};
        
        // Convert numeric strings to numbers for validation
        const parsedParams = {};
        for (const [key, value] of Object.entries(params)) {
          if (schema.shape[key]?._def?.typeName === 'ZodNumber') {
            parsedParams[key] = Number(value);
          } else {
            parsedParams[key] = value;
          }
        }
        
        // Validate parameters
        const validatedParams = await schema.parseAsync(parsedParams);
        
        // Replace query parameters with validated data
        event.queryStringParameters = validatedParams;
        
        // Call the handler
        return await handler(event, context);
      } catch (error) {
        console.error('Query parameter validation error:', error);
        
        if (error instanceof ZodError) {
          return {
            statusCode: 400,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              message: 'Invalid query parameters',
              errors: error.errors.map(err => ({
                field: err.path.join('.'),
                message: err.message
              }))
            })
          };
        }
        
        // Re-throw non-validation errors
        throw error;
      }
    };
  };
}

// Sanitize user input
function sanitizeInput(data) {
  if (typeof data === 'string') {
    // Remove potential XSS patterns
    return data
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeInput);
  }
  
  if (data && typeof data === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return data;
}

// Custom validators
const validators = {
  isValidEmail: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },
  
  isValidPhone: (phone) => {
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    return phoneRegex.test(phone);
  },
  
  isValidUrl: (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },
  
  isValidDate: (date) => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) return false;
    
    const d = new Date(date);
    return d instanceof Date && !isNaN(d);
  },
  
  isValidUUID: (uuid) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  },
};

module.exports = {
  schemas,
  validateRequest,
  validateQueryParams,
  sanitizeInput,
  validators,
  z,
};