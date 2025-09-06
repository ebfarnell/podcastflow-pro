const AWS = require('aws-sdk');
const { requireAuth } = require('./shared/authMiddleware');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME;

// Episode handlers
async function getEpisodes(event, user) {
  const showId = event.queryStringParameters?.showId;
  const assignedOnly = event.queryStringParameters?.assignedOnly === 'true';
  
  try {
    const params = {
      TableName: TABLE_NAME,
      IndexName: 'sk-data-index',
      KeyConditionExpression: 'sk = :sk',
      ExpressionAttributeValues: {
        ':sk': 'EPISODE'
      }
    };
    
    const result = await dynamodb.query(params).promise();
    let episodes = result.Items || [];
    
    // Filter by showId if provided
    if (showId) {
      episodes = episodes.filter(episode => episode.showId === showId);
    }
    
    // Filter by assignments based on role
    if (assignedOnly) {
      if (user.role === 'producer') {
        // Get shows assigned to producer
        const showsResult = await dynamodb.query({
          TableName: TABLE_NAME,
          IndexName: 'sk-data-index',
          KeyConditionExpression: 'sk = :sk',
          ExpressionAttributeValues: {
            ':sk': 'SHOW'
          }
        }).promise();
        
        const assignedShowIds = (showsResult.Items || [])
          .filter(show => show.assignedProducer === user.userId)
          .map(show => show.pk.split('#')[1]);
        
        episodes = episodes.filter(episode => assignedShowIds.includes(episode.showId));
      } else if (user.role === 'talent') {
        // Filter episodes assigned to talent
        episodes = episodes.filter(episode => 
          episode.assignedTalent?.includes(user.userId)
        );
      }
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        episodes,
        count: episodes.length
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  } catch (error) {
    console.error('Error getting episodes:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to get episodes' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
}

async function getEpisode(event, user) {
  const episodeId = event.pathParameters?.episodeId;
  
  if (!episodeId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Episode ID is required' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
  
  try {
    const result = await dynamodb.get({
      TableName: TABLE_NAME,
      Key: {
        pk: `EPISODE#${episodeId}`,
        sk: 'EPISODE'
      }
    }).promise();
    
    if (!result.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Episode not found' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }
    
    // Check access based on role
    const episode = result.Item;
    if (user.role === 'producer') {
      // Check if producer is assigned to the show
      const showResult = await dynamodb.get({
        TableName: TABLE_NAME,
        Key: {
          pk: `SHOW#${episode.showId}`,
          sk: 'SHOW'
        }
      }).promise();
      
      if (!showResult.Item || showResult.Item.assignedProducer !== user.userId) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'Access denied' }),
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        };
      }
    } else if (user.role === 'talent') {
      // Check if talent is assigned to the episode
      if (!episode.assignedTalent?.includes(user.userId)) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'Access denied' }),
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        };
      }
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify(episode),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  } catch (error) {
    console.error('Error getting episode:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to get episode' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
}

async function createEpisode(event, user) {
  try {
    const episodeData = JSON.parse(event.body);
    const timestamp = new Date().toISOString();
    const episodeId = `EP${Date.now()}`;
    
    // Validate required fields
    if (!episodeData.title || !episodeData.showId || !episodeData.airDate) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Title, show ID, and air date are required' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }
    
    // Check permissions based on role
    if (user.role === 'producer' || user.role === 'seller') {
      // Verify producer is assigned to the show
      if (user.role === 'producer') {
        const showResult = await dynamodb.get({
          TableName: TABLE_NAME,
          Key: {
            pk: `SHOW#${episodeData.showId}`,
            sk: 'SHOW'
          }
        }).promise();
        
        if (!showResult.Item || showResult.Item.assignedProducer !== user.userId) {
          return {
            statusCode: 403,
            body: JSON.stringify({ error: 'You are not assigned to this show' }),
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          };
        }
      }
    } else if (user.role !== 'admin') {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Permission denied' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }
    
    const episode = {
      pk: `EPISODE#${episodeId}`,
      sk: 'EPISODE',
      episodeId,
      title: episodeData.title,
      showId: episodeData.showId,
      description: episodeData.description || '',
      airDate: episodeData.airDate,
      duration: episodeData.duration || 0,
      status: episodeData.status || 'scheduled',
      assignedTalent: episodeData.assignedTalent || [],
      adSlots: episodeData.adSlots || [],
      notes: episodeData.notes || '',
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: user.userId
    };
    
    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: episode
    }).promise();
    
    // Log activity
    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: {
        pk: `AUDIT#${Date.now()}`,
        sk: 'AUDIT',
        entityType: 'episode',
        entityId: episodeId,
        action: 'create',
        userId: user.userId,
        timestamp,
        details: {
          episodeTitle: episode.title,
          showId: episode.showId
        }
      }
    }).promise();
    
    return {
      statusCode: 201,
      body: JSON.stringify(episode),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  } catch (error) {
    console.error('Error creating episode:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to create episode' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
}

async function updateEpisode(event, user) {
  const episodeId = event.pathParameters?.episodeId;
  
  if (!episodeId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Episode ID is required' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
  
  try {
    const updates = JSON.parse(event.body);
    const timestamp = new Date().toISOString();
    
    // Get existing episode
    const existingResult = await dynamodb.get({
      TableName: TABLE_NAME,
      Key: {
        pk: `EPISODE#${episodeId}`,
        sk: 'EPISODE'
      }
    }).promise();
    
    if (!existingResult.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Episode not found' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }
    
    const existingEpisode = existingResult.Item;
    
    // Check permissions
    if (user.role === 'producer') {
      const showResult = await dynamodb.get({
        TableName: TABLE_NAME,
        Key: {
          pk: `SHOW#${existingEpisode.showId}`,
          sk: 'SHOW'
        }
      }).promise();
      
      if (!showResult.Item || showResult.Item.assignedProducer !== user.userId) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'You are not assigned to this show' }),
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        };
      }
    } else if (user.role === 'talent') {
      // Talent can only update certain fields
      const allowedUpdates = ['notes', 'recordingStatus'];
      const updateKeys = Object.keys(updates);
      if (!updateKeys.every(key => allowedUpdates.includes(key))) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'You can only update notes and recording status' }),
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        };
      }
    } else if (user.role !== 'admin' && user.role !== 'seller') {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Permission denied' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }
    
    // Build update expression
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    
    Object.keys(updates).forEach(key => {
      if (key !== 'pk' && key !== 'sk' && key !== 'episodeId') {
        updateExpressions.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = updates[key];
      }
    });
    
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = timestamp;
    
    await dynamodb.update({
      TableName: TABLE_NAME,
      Key: {
        pk: `EPISODE#${episodeId}`,
        sk: 'EPISODE'
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues
    }).promise();
    
    // Log activity
    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: {
        pk: `AUDIT#${Date.now()}`,
        sk: 'AUDIT',
        entityType: 'episode',
        entityId: episodeId,
        action: 'update',
        userId: user.userId,
        timestamp,
        details: {
          updates: Object.keys(updates)
        }
      }
    }).promise();
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Episode updated successfully',
        episodeId 
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  } catch (error) {
    console.error('Error updating episode:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to update episode' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
}

async function deleteEpisode(event, user) {
  const episodeId = event.pathParameters?.episodeId;
  
  if (!episodeId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Episode ID is required' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
  
  try {
    // Only admin can delete episodes
    if (user.role !== 'admin') {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Only administrators can delete episodes' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }
    
    await dynamodb.delete({
      TableName: TABLE_NAME,
      Key: {
        pk: `EPISODE#${episodeId}`,
        sk: 'EPISODE'
      }
    }).promise();
    
    // Log activity
    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: {
        pk: `AUDIT#${Date.now()}`,
        sk: 'AUDIT',
        entityType: 'episode',
        entityId: episodeId,
        action: 'delete',
        userId: user.userId,
        timestamp: new Date().toISOString()
      }
    }).promise();
    
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Episode deleted successfully' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  } catch (error) {
    console.error('Error deleting episode:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to delete episode' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
}

// Talent assignment endpoints
async function assignTalent(event, user) {
  const episodeId = event.pathParameters?.episodeId;
  
  if (!episodeId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Episode ID is required' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
  
  try {
    const { talentId } = JSON.parse(event.body);
    const timestamp = new Date().toISOString();
    
    if (!talentId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Talent ID is required' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }
    
    // Check permissions
    if (user.role !== 'admin' && user.role !== 'producer' && user.role !== 'seller') {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Permission denied' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }
    
    // Get episode
    const episodeResult = await dynamodb.get({
      TableName: TABLE_NAME,
      Key: {
        pk: `EPISODE#${episodeId}`,
        sk: 'EPISODE'
      }
    }).promise();
    
    if (!episodeResult.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Episode not found' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }
    
    const episode = episodeResult.Item;
    
    // If producer, verify they're assigned to the show
    if (user.role === 'producer') {
      const showResult = await dynamodb.get({
        TableName: TABLE_NAME,
        Key: {
          pk: `SHOW#${episode.showId}`,
          sk: 'SHOW'
        }
      }).promise();
      
      if (!showResult.Item || showResult.Item.assignedProducer !== user.userId) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'You are not assigned to this show' }),
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        };
      }
    }
    
    // Add talent to episode
    const assignedTalent = episode.assignedTalent || [];
    if (!assignedTalent.includes(talentId)) {
      assignedTalent.push(talentId);
      
      await dynamodb.update({
        TableName: TABLE_NAME,
        Key: {
          pk: `EPISODE#${episodeId}`,
          sk: 'EPISODE'
        },
        UpdateExpression: 'SET assignedTalent = :talent, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':talent': assignedTalent,
          ':updatedAt': timestamp
        }
      }).promise();
      
      // Log activity
      await dynamodb.put({
        TableName: TABLE_NAME,
        Item: {
          pk: `AUDIT#${Date.now()}`,
          sk: 'AUDIT',
          entityType: 'episode',
          entityId: episodeId,
          action: 'assign_talent',
          userId: user.userId,
          timestamp,
          details: {
            talentId,
            episodeTitle: episode.title
          }
        }
      }).promise();
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Talent assigned successfully',
        episodeId,
        talentId
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  } catch (error) {
    console.error('Error assigning talent:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to assign talent' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
}

async function removeTalent(event, user) {
  const episodeId = event.pathParameters?.episodeId;
  const talentId = event.pathParameters?.talentId;
  
  if (!episodeId || !talentId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Episode ID and talent ID are required' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
  
  try {
    // Check permissions
    if (user.role !== 'admin' && user.role !== 'producer' && user.role !== 'seller') {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Permission denied' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }
    
    // Get episode
    const episodeResult = await dynamodb.get({
      TableName: TABLE_NAME,
      Key: {
        pk: `EPISODE#${episodeId}`,
        sk: 'EPISODE'
      }
    }).promise();
    
    if (!episodeResult.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Episode not found' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }
    
    const episode = episodeResult.Item;
    
    // If producer, verify they're assigned to the show
    if (user.role === 'producer') {
      const showResult = await dynamodb.get({
        TableName: TABLE_NAME,
        Key: {
          pk: `SHOW#${episode.showId}`,
          sk: 'SHOW'
        }
      }).promise();
      
      if (!showResult.Item || showResult.Item.assignedProducer !== user.userId) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'You are not assigned to this show' }),
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        };
      }
    }
    
    // Remove talent from episode
    const assignedTalent = (episode.assignedTalent || []).filter(id => id !== talentId);
    
    await dynamodb.update({
      TableName: TABLE_NAME,
      Key: {
        pk: `EPISODE#${episodeId}`,
        sk: 'EPISODE'
      },
      UpdateExpression: 'SET assignedTalent = :talent, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':talent': assignedTalent,
        ':updatedAt': new Date().toISOString()
      }
    }).promise();
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Talent removed successfully',
        episodeId,
        talentId
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  } catch (error) {
    console.error('Error removing talent:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to remove talent' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
}

// Lambda handler
exports.handler = requireAuth(async (event, context) => {
  const { httpMethod, path } = event;
  const user = event.user;
  
  // Route handling
  if (path === '/episodes' && httpMethod === 'GET') {
    return getEpisodes(event, user);
  } else if (path === '/episodes' && httpMethod === 'POST') {
    return createEpisode(event, user);
  } else if (path.match(/^\/episodes\/[^\/]+$/) && httpMethod === 'GET') {
    return getEpisode(event, user);
  } else if (path.match(/^\/episodes\/[^\/]+$/) && httpMethod === 'PUT') {
    return updateEpisode(event, user);
  } else if (path.match(/^\/episodes\/[^\/]+$/) && httpMethod === 'DELETE') {
    return deleteEpisode(event, user);
  } else if (path.match(/^\/episodes\/[^\/]+\/talent$/) && httpMethod === 'POST') {
    return assignTalent(event, user);
  } else if (path.match(/^\/episodes\/[^\/]+\/talent\/[^\/]+$/) && httpMethod === 'DELETE') {
    return removeTalent(event, user);
  }
  
  return {
    statusCode: 404,
    body: JSON.stringify({ error: 'Not found' }),
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  };
}, {
  permissions: ['episodes.view', 'episodes.create', 'episodes.edit', 'episodes.delete', 'episodes.assign']
});
