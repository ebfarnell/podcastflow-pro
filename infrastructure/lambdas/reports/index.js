const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const lambda = new AWS.Lambda();

const TABLE_NAME = process.env.TABLE_NAME || 'PodcastFlowPro';
const ANALYTICS_LAMBDA = process.env.ANALYTICS_LAMBDA_NAME || 'podcastflow-analytics';

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const { httpMethod, queryStringParameters, pathParameters } = event;
    const path = event.path || event.resource || '';

    switch (httpMethod) {
      case 'GET':
        if (path.includes('/revenue')) {
          return await getRevenueReport(queryStringParameters, headers);
        } else if (path.includes('/performance')) {
          return await getPerformanceReport(queryStringParameters, headers);
        } else if (path.includes('/audience')) {
          return await getAudienceReport(queryStringParameters, headers);
        } else if (path.includes('/campaigns')) {
          return await getCampaignReport(queryStringParameters, headers);
        } else if (path.includes('/scheduled')) {
          return await getScheduledReports(headers);
        } else if (pathParameters?.id) {
          return await getReport(pathParameters.id, headers);
        }
        return await getReportsSummary(headers);

      case 'POST':
        if (path.includes('/schedule')) {
          return await scheduleReport(JSON.parse(event.body), headers);
        } else if (path.includes('/generate')) {
          return await generateReport(JSON.parse(event.body), headers);
        }
        break;
        
      case 'DELETE':
        if (pathParameters?.id) {
          return await deleteScheduledReport(pathParameters.id, headers);
        }
        break;
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: 'Invalid request' })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: 'Internal server error', error: error.message })
    };
  }
};

async function getReportsSummary(headers) {
  // Get data from Analytics Lambda for real metrics
  const analyticsResponse = await lambda.invoke({
    FunctionName: ANALYTICS_LAMBDA,
    Payload: JSON.stringify({
      path: '/dashboard',
      queryStringParameters: { dateRange: 'thisMonth' }
    })
  }).promise();
  
  const dashboardData = JSON.parse(JSON.parse(analyticsResponse.Payload).body);
  
  // Get recent reports
  const recentReports = await dynamodb.query({
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: {
      ':pk': 'REPORTS'
    },
    Limit: 10,
    ScanIndexForward: false // Most recent first
  }).promise();
  
  const metrics = {
    totalRevenue: dashboardData.totalRevenue || 0,
    totalImpressions: dashboardData.totalImpressions || '0',
    avgCTR: dashboardData.conversionRate || 0,
    activeCampaigns: dashboardData.activeCampaigns || 0,
    monthlyGrowth: dashboardData.revenueGrowth || 0,
    topPerformingShow: dashboardData.topShows?.[0]?.name || 'N/A',
    recentReports: recentReports.Items || []
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(metrics)
  };
}

async function getRevenueReport(queryParams, headers) {
  const dateRange = queryParams?.dateRange || 'thisMonth';
  const period = queryParams?.period || 'monthly';
  
  // Get revenue data from Analytics Lambda
  const analyticsResponse = await lambda.invoke({
    FunctionName: ANALYTICS_LAMBDA,
    Payload: JSON.stringify({
      path: '/revenue',
      queryStringParameters: { period, dateRange }
    })
  }).promise();
  
  const revenueData = JSON.parse(JSON.parse(analyticsResponse.Payload).body);
  
  // Get top campaigns by revenue
  const campaignsData = await dynamodb.query({
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: {
      ':pk': 'CAMPAIGNS'
    }
  }).promise();
  
  // Sort campaigns by revenue and get top 10
  const topCampaigns = campaignsData.Items
    .filter(c => c.spent > 0)
    .sort((a, b) => (b.spent || 0) - (a.spent || 0))
    .slice(0, 10)
    .map(c => ({
      campaign: c.name,
      advertiser: c.client,
      revenue: c.spent || 0,
      status: c.status
    }));
  
  // Calculate revenue by source
  const revenueBySource = {};
  let totalRevenue = 0;
  
  campaignsData.Items.forEach(campaign => {
    const source = campaign.source || 'Direct';
    revenueBySource[source] = (revenueBySource[source] || 0) + (campaign.spent || 0);
    totalRevenue += campaign.spent || 0;
  });
  
  const bySource = Object.entries(revenueBySource).map(([source, amount]) => ({
    source,
    amount,
    percentage: totalRevenue > 0 ? Math.round((amount / totalRevenue) * 100) : 0
  }));
  
  const report = {
    dateRange,
    period,
    total: revenueData.totals?.revenue || totalRevenue,
    data: revenueData.data || [],
    bySource,
    topCampaigns,
    summary: revenueData.summary || {},
    generatedAt: new Date().toISOString()
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(report)
  };
}

async function getPerformanceReport(queryParams, headers) {
  const showId = queryParams?.showId;
  const dateRange = queryParams?.dateRange || 'thisMonth';
  
  // Get show performance from Analytics Lambda
  const analyticsResponse = await lambda.invoke({
    FunctionName: ANALYTICS_LAMBDA,
    Payload: JSON.stringify({
      path: '/shows/performance',
      queryStringParameters: { dateRange }
    })
  }).promise();
  
  const performanceData = JSON.parse(JSON.parse(analyticsResponse.Payload).body);
  
  // Get campaign metrics for trend data
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  
  const metricsData = await dynamodb.query({
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK BETWEEN :start AND :end',
    ExpressionAttributeValues: {
      ':pk': 'METRICS_DAILY',
      ':start': startDate.toISOString().split('T')[0],
      ':end': endDate.toISOString().split('T')[0]
    }
  }).promise();
  
  // Build impressions trend
  const impressionsTrend = metricsData.Items.map(item => ({
    date: item.date,
    impressions: item.impressions || 0,
    clicks: item.clicks || 0,
    ctr: item.impressions > 0 ? ((item.clicks / item.impressions) * 100).toFixed(2) : 0
  }));
  
  // Calculate conversion metrics
  let totalClicks = 0;
  let totalConversions = 0;
  let totalImpressions = 0;
  
  performanceData.shows?.forEach(show => {
    totalImpressions += parseInt(show.impressions) || 0;
    totalClicks += show.clicks || 0;
  });
  
  // Estimate conversions (4% of clicks)
  totalConversions = Math.floor(totalClicks * 0.04);
  
  const report = {
    dateRange,
    shows: performanceData.shows || [],
    impressionsTrend: impressionsTrend.length > 0 ? impressionsTrend : generateDefaultTrend(),
    conversionMetrics: {
      totalImpressions,
      totalClicks,
      totalConversions,
      conversionRate: totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(2) : 0,
      avgCTR: totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0
    },
    summary: performanceData.summary || {},
    generatedAt: new Date().toISOString()
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(report)
  };
}

async function getAudienceReport(queryParams, headers) {
  const dateRange = queryParams?.dateRange || 'thisMonth';
  
  // Get show and episode data
  const showsData = await dynamodb.query({
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: {
      ':pk': 'SHOWS'
    }
  }).promise();
  
  // Get episodes for engagement metrics
  const episodesData = await dynamodb.query({
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: {
      ':pk': 'EPISODES'
    },
    Limit: 100
  }).promise();
  
  // Calculate audience metrics
  let totalDownloads = 0;
  let totalDuration = 0;
  let episodeCount = 0;
  
  episodesData.Items.forEach(episode => {
    totalDownloads += episode.downloads || 0;
    totalDuration += episode.duration || 0;
    episodeCount++;
  });
  
  // Calculate average listen duration (estimate 65% completion)
  const avgListenDuration = episodeCount > 0 
    ? Math.floor((totalDuration / episodeCount) * 0.65) 
    : 0;
  
  // Format duration to MM:SS
  const minutes = Math.floor(avgListenDuration / 60);
  const seconds = avgListenDuration % 60;
  const formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  
  // Generate demographic data (in production, this would come from analytics)
  const audienceData = {
    dateRange,
    demographics: {
      ageGroups: [
        { range: '18-24', percentage: 12, count: Math.floor(totalDownloads * 0.12) },
        { range: '25-34', percentage: 38, count: Math.floor(totalDownloads * 0.38) },
        { range: '35-44', percentage: 28, count: Math.floor(totalDownloads * 0.28) },
        { range: '45-54', percentage: 15, count: Math.floor(totalDownloads * 0.15) },
        { range: '55+', percentage: 7, count: Math.floor(totalDownloads * 0.07) }
      ],
      gender: [
        { type: 'Male', percentage: 56, count: Math.floor(totalDownloads * 0.56) },
        { type: 'Female', percentage: 42, count: Math.floor(totalDownloads * 0.42) },
        { type: 'Other', percentage: 2, count: Math.floor(totalDownloads * 0.02) }
      ],
      locations: [
        { location: 'United States', percentage: 68, count: Math.floor(totalDownloads * 0.68) },
        { location: 'Canada', percentage: 12, count: Math.floor(totalDownloads * 0.12) },
        { location: 'United Kingdom', percentage: 8, count: Math.floor(totalDownloads * 0.08) },
        { location: 'Australia', percentage: 6, count: Math.floor(totalDownloads * 0.06) },
        { location: 'Other', percentage: 6, count: Math.floor(totalDownloads * 0.06) }
      ]
    },
    interests: generateInterestsFromShows(showsData.Items),
    engagement: {
      avgListenDuration: formattedDuration,
      completionRate: 65,
      shareRate: 8,
      subscriptionRate: 22,
      totalDownloads,
      uniqueListeners: Math.floor(totalDownloads * 0.7)
    },
    generatedAt: new Date().toISOString()
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(audienceData)
  };
}

async function getCampaignReport(queryParams, headers) {
  const campaignId = queryParams?.campaignId;
  const dateRange = queryParams?.dateRange || 'thisMonth';
  
  let campaigns;
  
  if (campaignId) {
    // Get specific campaign
    const result = await dynamodb.get({
      TableName: TABLE_NAME,
      Key: {
        PK: `CAMPAIGN#${campaignId}`,
        SK: 'METADATA'
      }
    }).promise();
    
    campaigns = result.Item ? [result.Item] : [];
  } else {
    // Get all campaigns
    const result = await dynamodb.query({
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'CAMPAIGNS'
      }
    }).promise();
    
    campaigns = result.Items || [];
  }
  
  // Format campaign data
  const formattedCampaigns = campaigns.map(campaign => ({
    id: campaign.id,
    name: campaign.name,
    advertiser: campaign.client,
    status: campaign.status,
    impressions: campaign.impressions || 0,
    clicks: campaign.clicks || 0,
    ctr: campaign.impressions > 0 ? ((campaign.clicks / campaign.impressions) * 100).toFixed(2) : 0,
    conversions: campaign.conversions || Math.floor((campaign.clicks || 0) * 0.04),
    revenue: campaign.spent || 0,
    budget: campaign.budget || 0,
    roi: campaign.budget > 0 ? (((campaign.spent - campaign.budget) / campaign.budget) * 100).toFixed(0) : 0,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    createdAt: campaign.createdAt
  }));
  
  // Calculate summary
  const summary = {
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter(c => c.status === 'active').length,
    completedCampaigns: campaigns.filter(c => c.status === 'completed').length,
    scheduledCampaigns: campaigns.filter(c => c.status === 'scheduled').length,
    pausedCampaigns: campaigns.filter(c => c.status === 'paused').length,
    totalRevenue: campaigns.reduce((sum, c) => sum + (c.spent || 0), 0),
    totalBudget: campaigns.reduce((sum, c) => sum + (c.budget || 0), 0),
    avgCTR: calculateAverage(formattedCampaigns.map(c => parseFloat(c.ctr))),
    avgROI: calculateAverage(formattedCampaigns.map(c => parseFloat(c.roi)))
  };
  
  const report = {
    dateRange,
    campaigns: formattedCampaigns,
    summary,
    generatedAt: new Date().toISOString()
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(report)
  };
}

async function generateReport(reportData, headers) {
  const reportId = `RPT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const timestamp = new Date().toISOString();
  
  // Generate the report based on type
  let reportContent;
  
  switch (reportData.type) {
    case 'revenue':
      const revenueResult = await getRevenueReport(reportData.params || {}, headers);
      reportContent = JSON.parse(revenueResult.body);
      break;
    case 'performance':
      const performanceResult = await getPerformanceReport(reportData.params || {}, headers);
      reportContent = JSON.parse(performanceResult.body);
      break;
    case 'audience':
      const audienceResult = await getAudienceReport(reportData.params || {}, headers);
      reportContent = JSON.parse(audienceResult.body);
      break;
    case 'campaign':
      const campaignResult = await getCampaignReport(reportData.params || {}, headers);
      reportContent = JSON.parse(campaignResult.body);
      break;
    default:
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid report type' })
      };
  }
  
  // Save report to database
  const item = {
    PK: `REPORT#${reportId}`,
    SK: 'METADATA',
    GSI1PK: 'REPORTS',
    GSI1SK: timestamp,
    id: reportId,
    type: reportData.type,
    name: reportData.name || `${reportData.type} Report`,
    params: reportData.params || {},
    content: reportContent,
    format: reportData.format || 'json',
    status: 'completed',
    createdAt: timestamp,
    createdBy: reportData.userId || 'system'
  };
  
  await dynamodb.put({
    TableName: TABLE_NAME,
    Item: item
  }).promise();
  
  return {
    statusCode: 201,
    headers,
    body: JSON.stringify({
      reportId,
      type: reportData.type,
      status: 'completed',
      content: reportContent
    })
  };
}

async function scheduleReport(scheduleData, headers) {
  const reportId = `SCHEDULE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const timestamp = new Date().toISOString();
  
  // Calculate next run time
  const nextRun = calculateNextRun(scheduleData.frequency, scheduleData.time);

  const item = {
    PK: `REPORT#${reportId}`,
    SK: 'SCHEDULE',
    GSI1PK: 'SCHEDULED_REPORTS',
    GSI1SK: nextRun,
    id: reportId,
    type: scheduleData.type,
    name: scheduleData.name,
    frequency: scheduleData.frequency,
    time: scheduleData.time,
    params: scheduleData.params || {},
    recipients: scheduleData.recipients || [],
    format: scheduleData.format || 'pdf',
    nextRun,
    lastRun: null,
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp
  };

  await dynamodb.put({
    TableName: TABLE_NAME,
    Item: item
  }).promise();

  return {
    statusCode: 201,
    headers,
    body: JSON.stringify(item)
  };
}

async function getScheduledReports(headers) {
  const result = await dynamodb.query({
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: {
      ':pk': 'SCHEDULED_REPORTS'
    }
  }).promise();
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      scheduledReports: result.Items || [],
      count: result.Count || 0
    })
  };
}

async function getReport(reportId, headers) {
  const result = await dynamodb.get({
    TableName: TABLE_NAME,
    Key: {
      PK: `REPORT#${reportId}`,
      SK: 'METADATA'
    }
  }).promise();
  
  if (!result.Item) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Report not found' })
    };
  }
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(result.Item)
  };
}

async function deleteScheduledReport(reportId, headers) {
  await dynamodb.delete({
    TableName: TABLE_NAME,
    Key: {
      PK: `REPORT#${reportId}`,
      SK: 'SCHEDULE'
    }
  }).promise();
  
  return {
    statusCode: 204,
    headers,
    body: ''
  };
}

// Helper functions
function generateDefaultTrend() {
  const trend = [];
  const now = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    trend.push({
      date: date.toISOString().split('T')[0],
      impressions: Math.floor(Math.random() * 50000) + 400000,
      clicks: Math.floor(Math.random() * 2000) + 15000,
      ctr: (3.5 + Math.random()).toFixed(2)
    });
  }
  
  return trend;
}

function generateInterestsFromShows(shows) {
  const categories = {};
  
  shows.forEach(show => {
    const category = show.category || 'General';
    categories[category] = (categories[category] || 0) + 1;
  });
  
  const totalShows = shows.length || 1;
  
  return Object.entries(categories)
    .map(([category, count]) => ({
      category,
      score: Math.round((count / totalShows) * 100)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function calculateAverage(numbers) {
  if (numbers.length === 0) return 0;
  const sum = numbers.reduce((acc, num) => acc + (num || 0), 0);
  return (sum / numbers.length).toFixed(2);
}

function calculateNextRun(frequency, time) {
  const now = new Date();
  const [hours, minutes] = time.split(':').map(Number);
  
  let nextRun = new Date();
  nextRun.setHours(hours, minutes, 0, 0);
  
  switch (frequency) {
    case 'daily':
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      break;
    case 'weekly':
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 7);
      }
      break;
    case 'monthly':
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 1);
      }
      break;
  }
  
  return nextRun.toISOString();
}