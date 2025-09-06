const AWS = require('aws-sdk');
const lambda = new AWS.Lambda();

const WEBSOCKET_FUNCTION_NAME = process.env.WEBSOCKET_FUNCTION_NAME || 'podcastflow-websocket-handler';

/**
 * Broadcast an update through the WebSocket system
 * @param {string} channel - The channel to broadcast on
 * @param {string} entityType - The type of entity (campaign, show, episode, etc.)
 * @param {string} entityId - The ID of the specific entity
 * @param {string} eventType - The type of event (created, updated, deleted, etc.)
 * @param {object} payload - The event payload
 */
async function broadcastUpdate(channel, entityType, entityId, eventType, payload) {
  try {
    const params = {
      FunctionName: WEBSOCKET_FUNCTION_NAME,
      InvocationType: 'Event', // Async invocation
      Payload: JSON.stringify({
        routeKey: 'broadcast',
        body: JSON.stringify({
          channel,
          entityType,
          entityId,
          eventType,
          payload
        })
      })
    };
    
    await lambda.invoke(params).promise();
    console.log(`Broadcast sent: ${channel}:${entityType}:${entityId} - ${eventType}`);
  } catch (error) {
    console.error('Failed to broadcast update:', error);
    // Don't throw - broadcasting failures shouldn't break the main operation
  }
}

/**
 * Broadcast a campaign update
 */
async function broadcastCampaignUpdate(campaignId, eventType, data, userId, userRole) {
  await broadcastUpdate('updates', 'campaign', campaignId, eventType, {
    action: eventType,
    data,
    userId,
    userRole,
    timestamp: new Date().toISOString()
  });
}

/**
 * Broadcast a show update
 */
async function broadcastShowUpdate(showId, eventType, data, userId, userRole) {
  await broadcastUpdate('updates', 'show', showId, eventType, {
    action: eventType,
    data,
    userId,
    userRole,
    timestamp: new Date().toISOString()
  });
}

/**
 * Broadcast an episode update
 */
async function broadcastEpisodeUpdate(episodeId, eventType, data, userId, userRole) {
  await broadcastUpdate('updates', 'episode', episodeId, eventType, {
    action: eventType,
    data,
    userId,
    userRole,
    timestamp: new Date().toISOString()
  });
  
  // Also broadcast to show channel if showId is available
  if (data.showId) {
    await broadcastUpdate('updates', 'show', data.showId, `episode_${eventType}`, {
      action: eventType,
      episodeId,
      data,
      userId,
      userRole,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Broadcast a client update
 */
async function broadcastClientUpdate(clientId, eventType, data, userId, userRole) {
  await broadcastUpdate('updates', 'client', clientId, eventType, {
    action: eventType,
    data,
    userId,
    userRole,
    timestamp: new Date().toISOString()
  });
}

/**
 * Broadcast a user notification
 */
async function broadcastUserNotification(userId, eventType, data) {
  await broadcastUpdate('notifications', 'user', userId, eventType, {
    action: eventType,
    data,
    timestamp: new Date().toISOString()
  });
}

/**
 * Broadcast a role notification
 */
async function broadcastRoleNotification(role, eventType, data) {
  await broadcastUpdate('notifications', 'role', role, eventType, {
    action: eventType,
    data,
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  broadcastUpdate,
  broadcastCampaignUpdate,
  broadcastShowUpdate,
  broadcastEpisodeUpdate,
  broadcastClientUpdate,
  broadcastUserNotification,
  broadcastRoleNotification
};