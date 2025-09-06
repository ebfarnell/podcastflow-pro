const AWS = require('aws-sdk');
const { requireAuth, hasPermission } = require('../shared/authMiddleware');
const { v4: uuidv4 } = require('uuid');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const cloudwatch = new AWS.CloudWatch();
const lambda = new AWS.Lambda();

const TABLE_NAME = process.env.TABLE_NAME || 'PodcastFlowPro';
const REGION = process.env.AWS_REGION || 'us-east-1';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS'
};

// Services to monitor
const SERVICES = [
  { name: 'API Gateway', namespace: 'AWS/ApiGateway', metricName: 'Count' },
  { name: 'Lambda Functions', namespace: 'AWS/Lambda', metricName: 'Invocations' },
  { name: 'DynamoDB', namespace: 'AWS/DynamoDB', metricName: 'ConsumedReadCapacityUnits' },
  { name: 'WebSocket API', namespace: 'AWS/ApiGateway', metricName: 'ConnectCount' },
  { name: 'S3 Backups', namespace: 'AWS/S3', metricName: 'NumberOfObjects' }
];

// Main handler
const mainHandler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: ''
    };
  }

  // Handle CloudWatch scheduled health checks
  if (event.source === 'aws.events') {
    return await performHealthCheck();
  }

  try {
    const { httpMethod, path, queryStringParameters } = event;
    const user = event.user;

    // Check permissions
    if (!hasPermission(user, 'monitoring.view')) {
      return {
        statusCode: 403,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Forbidden: Cannot view monitoring data' })
      };
    }

    if (path.includes('/health')) {
      return await getSystemHealth();
    } else if (path.includes('/metrics')) {
      return await getMetrics(queryStringParameters);
    } else if (path.includes('/alerts')) {
      if (httpMethod === 'GET') {
        return await getAlerts(queryStringParameters);
      } else if (httpMethod === 'PUT' && path.includes('/acknowledge')) {
        return await acknowledgeAlert(event.pathParameters.alertId, user);
      } else if (httpMethod === 'PUT' && path.includes('/resolve')) {
        return await resolveAlert(event.pathParameters.alertId, user);
      }
    } else if (path.includes('/services/')) {
      return await getServiceStatus(event.pathParameters.service);
    } else if (path.includes('/logs')) {
      return await getLogs(queryStringParameters);
    }

    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Not found' })
    };
  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: error.statusCode || 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ 
        message: error.message || 'Internal server error',
        error: error.toString()
      })
    };
  }
};

// Get system health
async function getSystemHealth() {
  try {
    const healthChecks = await Promise.allSettled(
      SERVICES.map(service => checkServiceHealth(service))
    );

    const services = healthChecks.map((result, index) => ({
      name: SERVICES[index].name,
      ...(result.status === 'fulfilled' ? result.value : {
        status: 'down',
        latency: 0,
        errorRate: 100,
        uptime: 0
      })
    }));

    // Calculate overall health
    const unhealthyServices = services.filter(s => s.status !== 'operational');
    let overallStatus = 'healthy';
    
    if (unhealthyServices.length > 0) {
      const criticalServices = unhealthyServices.filter(s => s.status === 'down');
      overallStatus = criticalServices.length > 0 ? 'critical' : 'degraded';
    }

    // Store health status
    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: {
        PK: 'MONITORING#HEALTH',
        SK: new Date().toISOString(),
        status: overallStatus,
        services,
        timestamp: new Date().toISOString(),
        ttl: Math.floor(Date.now() / 1000) + 86400 // Keep for 24 hours
      }
    }).promise();

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        status: overallStatus,
        services,
        lastChecked: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Error getting system health:', error);
    throw error;
  }
}

// Check individual service health
async function checkServiceHealth(service) {
  try {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 5 * 60 * 1000); // Last 5 minutes

    // Get service metrics
    const params = {
      Namespace: service.namespace,
      MetricName: service.metricName,
      StartTime: startTime,
      EndTime: endTime,
      Period: 300,
      Statistics: ['Average', 'Sum'],
    };

    if (service.name === 'API Gateway') {
      params.Dimensions = [{ Name: 'ApiName', Value: 'PodcastFlowPro' }];
    } else if (service.name === 'DynamoDB') {
      params.Dimensions = [{ Name: 'TableName', Value: TABLE_NAME }];
    }

    const metrics = await cloudwatch.getMetricStatistics(params).promise();

    // Get error metrics
    const errorParams = {
      ...params,
      MetricName: service.namespace === 'AWS/Lambda' ? 'Errors' : '4XXError'
    };

    const errorMetrics = await cloudwatch.getMetricStatistics(errorParams).promise();

    // Calculate health metrics
    const totalRequests = metrics.Datapoints.reduce((sum, dp) => sum + (dp.Sum || 0), 0);
    const totalErrors = errorMetrics.Datapoints.reduce((sum, dp) => sum + (dp.Sum || 0), 0);
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
    
    // Get latency for API Gateway
    let latency = 0;
    if (service.name === 'API Gateway') {
      const latencyParams = {
        ...params,
        MetricName: 'Latency',
        Statistics: ['Average']
      };
      const latencyMetrics = await cloudwatch.getMetricStatistics(latencyParams).promise();
      latency = latencyMetrics.Datapoints.length > 0 
        ? Math.round(latencyMetrics.Datapoints.reduce((sum, dp) => sum + dp.Average, 0) / latencyMetrics.Datapoints.length)
        : 0;
    }

    // Determine status
    let status = 'operational';
    if (errorRate > 10) {
      status = 'down';
    } else if (errorRate > 5 || latency > 1000) {
      status = 'degraded';
    }

    // Calculate uptime (simplified - based on error rate)
    const uptime = 1 - (errorRate / 100);

    return {
      status,
      latency,
      errorRate: parseFloat(errorRate.toFixed(2)),
      uptime: parseFloat(uptime.toFixed(4))
    };
  } catch (error) {
    console.error(`Error checking health for ${service.name}:`, error);
    return {
      status: 'unknown',
      latency: 0,
      errorRate: 0,
      uptime: 1
    };
  }
}

// Get metrics
async function getMetrics(queryParams) {
  try {
    const timeRange = queryParams?.timeRange || '1h';
    const endTime = new Date();
    let startTime;
    let period;

    switch (timeRange) {
      case '1h':
        startTime = new Date(endTime.getTime() - 60 * 60 * 1000);
        period = 300; // 5 minutes
        break;
      case '6h':
        startTime = new Date(endTime.getTime() - 6 * 60 * 60 * 1000);
        period = 900; // 15 minutes
        break;
      case '24h':
        startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
        period = 3600; // 1 hour
        break;
      case '7d':
        startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000);
        period = 21600; // 6 hours
        break;
      default:
        startTime = new Date(endTime.getTime() - 60 * 60 * 1000);
        period = 300;
    }

    // Get various metrics
    const [apiMetrics, latencyMetrics, errorMetrics, lambdaMetrics] = await Promise.all([
      getCloudWatchMetrics('AWS/ApiGateway', 'Count', startTime, endTime, period),
      getCloudWatchMetrics('AWS/ApiGateway', 'Latency', startTime, endTime, period),
      getCloudWatchMetrics('AWS/ApiGateway', '4XXError', startTime, endTime, period),
      getCloudWatchMetrics('AWS/Lambda', 'Duration', startTime, endTime, period)
    ]);

    // Combine metrics by timestamp
    const metricsMap = new Map();
    
    apiMetrics.Datapoints.forEach(dp => {
      const key = dp.Timestamp.toISOString();
      metricsMap.set(key, {
        timestamp: key,
        apiCalls: dp.Sum || 0,
        avgLatency: 0,
        errorRate: 0,
        activeUsers: Math.floor((dp.Sum || 0) / 10), // Estimate
        cpuUsage: Math.random() * 60 + 20, // Mock data
        memoryUsage: Math.random() * 70 + 20, // Mock data
        dbConnections: Math.floor(Math.random() * 50 + 10) // Mock data
      });
    });

    latencyMetrics.Datapoints.forEach(dp => {
      const key = dp.Timestamp.toISOString();
      if (metricsMap.has(key)) {
        metricsMap.get(key).avgLatency = Math.round(dp.Average || 0);
      }
    });

    errorMetrics.Datapoints.forEach(dp => {
      const key = dp.Timestamp.toISOString();
      if (metricsMap.has(key)) {
        const metric = metricsMap.get(key);
        metric.errorRate = metric.apiCalls > 0 ? ((dp.Sum || 0) / metric.apiCalls) * 100 : 0;
      }
    });

    const metrics = Array.from(metricsMap.values()).sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        metrics,
        timeRange,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString()
      })
    };
  } catch (error) {
    console.error('Error getting metrics:', error);
    throw error;
  }
}

// Get CloudWatch metrics
async function getCloudWatchMetrics(namespace, metricName, startTime, endTime, period) {
  const params = {
    Namespace: namespace,
    MetricName: metricName,
    StartTime: startTime,
    EndTime: endTime,
    Period: period,
    Statistics: ['Sum', 'Average']
  };

  if (namespace === 'AWS/ApiGateway') {
    params.Dimensions = [{ Name: 'ApiName', Value: 'PodcastFlowPro' }];
  }

  return await cloudwatch.getMetricStatistics(params).promise();
}

// Get alerts
async function getAlerts(queryParams) {
  try {
    const unresolved = queryParams?.unresolved === 'true';
    
    const params = {
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'ALERT'
      },
      ScanIndexForward: false, // Newest first
      Limit: 50
    };

    if (unresolved) {
      params.FilterExpression = 'resolved = :resolved';
      params.ExpressionAttributeValues[':resolved'] = false;
    }

    const result = await dynamodb.query(params).promise();

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        alerts: result.Items,
        count: result.Items.length
      })
    };
  } catch (error) {
    console.error('Error getting alerts:', error);
    throw error;
  }
}

// Create alert
async function createAlert(severity, title, message, service) {
  const alertId = uuidv4();
  const timestamp = new Date().toISOString();

  const alert = {
    PK: `ALERT#${alertId}`,
    SK: 'METADATA',
    GSI1PK: 'ALERT',
    GSI1SK: timestamp,
    id: alertId,
    severity,
    title,
    message,
    service,
    timestamp,
    resolved: false,
    acknowledged: false,
    createdAt: timestamp,
    ttl: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 // Keep for 7 days
  };

  await dynamodb.put({
    TableName: TABLE_NAME,
    Item: alert
  }).promise();

  // Send notification for critical alerts
  if (severity === 'critical' || severity === 'error') {
    // Could integrate with SNS here
    console.log('Critical alert created:', alert);
  }

  return alert;
}

// Acknowledge alert
async function acknowledgeAlert(alertId, user) {
  try {
    await dynamodb.update({
      TableName: TABLE_NAME,
      Key: {
        PK: `ALERT#${alertId}`,
        SK: 'METADATA'
      },
      UpdateExpression: 'SET acknowledged = :true, acknowledgedBy = :user, acknowledgedAt = :time',
      ExpressionAttributeValues: {
        ':true': true,
        ':user': user.userId,
        ':time': new Date().toISOString()
      }
    }).promise();

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Alert acknowledged' })
    };
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    throw error;
  }
}

// Resolve alert
async function resolveAlert(alertId, user) {
  try {
    await dynamodb.update({
      TableName: TABLE_NAME,
      Key: {
        PK: `ALERT#${alertId}`,
        SK: 'METADATA'
      },
      UpdateExpression: 'SET resolved = :true, resolvedBy = :user, resolvedAt = :time',
      ExpressionAttributeValues: {
        ':true': true,
        ':user': user.userId,
        ':time': new Date().toISOString()
      }
    }).promise();

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Alert resolved' })
    };
  } catch (error) {
    console.error('Error resolving alert:', error);
    throw error;
  }
}

// Perform scheduled health check
async function performHealthCheck() {
  try {
    const health = await getSystemHealth();
    const healthData = JSON.parse(health.body);

    // Check for issues and create alerts
    if (healthData.status === 'critical') {
      await createAlert(
        'critical',
        'System Health Critical',
        'One or more services are down',
        'System'
      );
    } else if (healthData.status === 'degraded') {
      await createAlert(
        'warning',
        'System Health Degraded',
        'One or more services are experiencing issues',
        'System'
      );
    }

    // Check individual services
    for (const service of healthData.services) {
      if (service.status === 'down') {
        await createAlert(
          'error',
          `${service.name} Down`,
          `${service.name} is not responding`,
          service.name
        );
      } else if (service.errorRate > 10) {
        await createAlert(
          'warning',
          `High Error Rate - ${service.name}`,
          `Error rate is ${service.errorRate}%`,
          service.name
        );
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Health check completed' })
    };
  } catch (error) {
    console.error('Health check failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}

// Export handler with auth middleware
exports.handler = requireAuth(mainHandler);