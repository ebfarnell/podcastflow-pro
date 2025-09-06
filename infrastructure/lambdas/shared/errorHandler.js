const AWS = require('aws-sdk');
const sns = new AWS.SNS();
const cloudwatch = new AWS.CloudWatch();

// Error types
const ErrorTypes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  CONFLICT_ERROR: 'CONFLICT_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
};

// Custom error classes
class BaseError extends Error {
  constructor(message, statusCode, errorType, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorType = errorType;
    this.details = details;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      type: this.errorType,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
      ...(process.env.NODE_ENV === 'development' && { stack: this.stack })
    };
  }
}

class ValidationError extends BaseError {
  constructor(message, details = {}) {
    super(message, 400, ErrorTypes.VALIDATION_ERROR, details);
  }
}

class AuthenticationError extends BaseError {
  constructor(message = 'Authentication required', details = {}) {
    super(message, 401, ErrorTypes.AUTHENTICATION_ERROR, details);
  }
}

class AuthorizationError extends BaseError {
  constructor(message = 'Insufficient permissions', details = {}) {
    super(message, 403, ErrorTypes.AUTHORIZATION_ERROR, details);
  }
}

class NotFoundError extends BaseError {
  constructor(resource, identifier) {
    super(`${resource} not found`, 404, ErrorTypes.NOT_FOUND_ERROR, { resource, identifier });
  }
}

class ConflictError extends BaseError {
  constructor(message, details = {}) {
    super(message, 409, ErrorTypes.CONFLICT_ERROR, details);
  }
}

class RateLimitError extends BaseError {
  constructor(retryAfter = 60) {
    super('Too many requests', 429, ErrorTypes.RATE_LIMIT_ERROR, { retryAfter });
  }
}

class ExternalAPIError extends BaseError {
  constructor(service, originalError) {
    super(`External API error: ${service}`, 502, ErrorTypes.EXTERNAL_API_ERROR, {
      service,
      originalError: originalError.message
    });
  }
}

class DatabaseError extends BaseError {
  constructor(operation, originalError) {
    super('Database operation failed', 500, ErrorTypes.DATABASE_ERROR, {
      operation,
      originalError: originalError.message
    });
  }
}

class TimeoutError extends BaseError {
  constructor(operation, timeout) {
    super(`Operation timed out: ${operation}`, 504, ErrorTypes.TIMEOUT_ERROR, {
      operation,
      timeout
    });
  }
}

// Error handler middleware
const errorHandler = (handler) => {
  return async (event, context) => {
    // Set up timeout handler
    const timeoutMs = context.getRemainingTimeInMillis() - 1000; // Leave 1s buffer
    let timeoutHandle;
    
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new TimeoutError('Lambda function', timeoutMs));
      }, timeoutMs);
    });

    try {
      // Race between handler and timeout
      const result = await Promise.race([
        handler(event, context),
        timeoutPromise
      ]);
      
      clearTimeout(timeoutHandle);
      return result;
    } catch (error) {
      clearTimeout(timeoutHandle);
      
      console.error('Error in handler:', error);
      
      // Log error metrics
      await logErrorMetric(error, event, context);
      
      // Send alert for critical errors
      if (shouldAlert(error)) {
        await sendErrorAlert(error, event, context);
      }
      
      // Return formatted error response
      return formatErrorResponse(error);
    }
  };
};

// Format error response
function formatErrorResponse(error) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  };

  if (error instanceof BaseError) {
    // Handle known errors
    if (error instanceof RateLimitError) {
      headers['Retry-After'] = error.details.retryAfter;
    }
    
    return {
      statusCode: error.statusCode,
      headers,
      body: JSON.stringify({
        error: {
          message: error.message,
          type: error.errorType,
          details: error.details,
          timestamp: error.timestamp,
          requestId: context?.awsRequestId
        }
      })
    };
  }

  // Handle unknown errors
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    statusCode: 500,
    headers,
    body: JSON.stringify({
      error: {
        message: isProduction ? 'Internal server error' : error.message,
        type: ErrorTypes.INTERNAL_ERROR,
        timestamp: new Date().toISOString(),
        requestId: context?.awsRequestId,
        ...(isProduction ? {} : { stack: error.stack })
      }
    })
  };
}

// Log error metrics to CloudWatch
async function logErrorMetric(error, event, context) {
  const metricData = {
    Namespace: 'PodcastFlowPro/Errors',
    MetricData: [
      {
        MetricName: 'ErrorCount',
        Value: 1,
        Unit: 'Count',
        Dimensions: [
          {
            Name: 'ErrorType',
            Value: error.errorType || 'UNKNOWN'
          },
          {
            Name: 'FunctionName',
            Value: context.functionName
          },
          {
            Name: 'HTTPMethod',
            Value: event.httpMethod || 'UNKNOWN'
          }
        ],
        Timestamp: new Date()
      }
    ]
  };

  try {
    await cloudwatch.putMetricData(metricData).promise();
  } catch (metricError) {
    console.error('Failed to log error metric:', metricError);
  }
}

// Determine if error should trigger an alert
function shouldAlert(error) {
  // Alert on database errors, timeouts, and unknown errors
  return (
    error instanceof DatabaseError ||
    error instanceof TimeoutError ||
    !(error instanceof BaseError) ||
    error.statusCode >= 500
  );
}

// Send error alert via SNS
async function sendErrorAlert(error, event, context) {
  const topicArn = process.env.ERROR_ALERT_TOPIC_ARN;
  
  if (!topicArn) {
    console.warn('ERROR_ALERT_TOPIC_ARN not configured, skipping alert');
    return;
  }

  const message = {
    FunctionName: context.functionName,
    RequestId: context.awsRequestId,
    ErrorType: error.errorType || 'UNKNOWN',
    ErrorMessage: error.message,
    HTTPMethod: event.httpMethod,
    Path: event.path,
    Timestamp: new Date().toISOString(),
    StackTrace: error.stack
  };

  try {
    await sns.publish({
      TopicArn: topicArn,
      Subject: `[PodcastFlowPro] Error in ${context.functionName}`,
      Message: JSON.stringify(message, null, 2)
    }).promise();
  } catch (alertError) {
    console.error('Failed to send error alert:', alertError);
  }
}

// Retry mechanism for external API calls
async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    shouldRetry = (error) => error.statusCode >= 500 || error.code === 'ECONNRESET'
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }
      
      console.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw lastError;
}

// Circuit breaker for external services
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 10000; // 10 seconds
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= 3) {
        this.state = 'CLOSED';
        console.log('Circuit breaker switched to CLOSED');
      }
    }
  }

  onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      console.error('Circuit breaker switched to OPEN');
    }
  }
}

// Dead letter queue handler
async function handleDeadLetter(event, error, context) {
  const dlqUrl = process.env.DLQ_URL;
  
  if (!dlqUrl) {
    console.warn('DLQ_URL not configured, skipping dead letter');
    return;
  }

  const sqs = new AWS.SQS();
  
  const message = {
    originalEvent: event,
    error: {
      message: error.message,
      type: error.errorType || 'UNKNOWN',
      stack: error.stack
    },
    context: {
      functionName: context.functionName,
      requestId: context.awsRequestId,
      remainingTime: context.getRemainingTimeInMillis()
    },
    timestamp: new Date().toISOString()
  };

  try {
    await sqs.sendMessage({
      QueueUrl: dlqUrl,
      MessageBody: JSON.stringify(message),
      MessageAttributes: {
        ErrorType: {
          DataType: 'String',
          StringValue: error.errorType || 'UNKNOWN'
        },
        FunctionName: {
          DataType: 'String',
          StringValue: context.functionName
        }
      }
    }).promise();
  } catch (dlqError) {
    console.error('Failed to send to DLQ:', dlqError);
  }
}

// Recovery strategies
const recoveryStrategies = {
  // Retry with exponential backoff
  async retry(fn, error, options = {}) {
    if (error.statusCode === 429 || error.code === 'ProvisionedThroughputExceededException') {
      return retryWithBackoff(fn, {
        ...options,
        shouldRetry: () => true
      });
    }
    throw error;
  },

  // Fallback to cached data
  async fallback(fn, error, fallbackFn) {
    console.warn('Using fallback due to error:', error.message);
    return fallbackFn();
  },

  // Queue for later processing
  async queue(event, error, queueUrl) {
    const sqs = new AWS.SQS();
    
    await sqs.sendMessage({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({
        event,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      DelaySeconds: 60 // Delay 1 minute before retry
    }).promise();
    
    return {
      statusCode: 202,
      body: JSON.stringify({
        message: 'Request queued for processing'
      })
    };
  }
};

module.exports = {
  // Error classes
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ExternalAPIError,
  DatabaseError,
  TimeoutError,
  
  // Error types
  ErrorTypes,
  
  // Middleware and utilities
  errorHandler,
  formatErrorResponse,
  retryWithBackoff,
  CircuitBreaker,
  handleDeadLetter,
  recoveryStrategies
};