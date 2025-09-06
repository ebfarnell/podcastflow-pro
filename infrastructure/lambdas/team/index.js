const AWS = require('aws-sdk')
const dynamodb = new AWS.DynamoDB.DocumentClient()
const { v4: uuidv4 } = require('uuid')
const EmailService = require('../shared/emailService')

const TABLE_NAME = process.env.TABLE_NAME || 'PodcastFlowPro'
const emailService = new EmailService()

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
}

exports.handler = async (event) => {
  console.log('Team Lambda received event:', JSON.stringify(event))
  
  const { httpMethod, pathParameters, body, requestContext } = event
  
  // Handle preflight OPTIONS requests
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'OK' })
    }
  }
  
  try {
    const userId = requestContext?.authorizer?.claims?.sub || 'test-user'
    const organizationId = pathParameters?.organizationId || 'default-org'
    
    switch (httpMethod) {
      case 'GET':
        if (pathParameters?.memberId) {
          // Get specific team member
          return await getTeamMember(organizationId, pathParameters.memberId)
        } else {
          // Get all team members
          return await getTeamMembers(organizationId)
        }
        
      case 'POST':
        // Invite new team member
        const inviteData = JSON.parse(body)
        return await inviteTeamMember(organizationId, inviteData, userId)
        
      case 'PUT':
        // Update team member (role, status, etc.)
        const updateData = JSON.parse(body)
        return await updateTeamMember(organizationId, pathParameters.memberId, updateData)
        
      case 'DELETE':
        // Remove team member
        return await removeTeamMember(organizationId, pathParameters.memberId, userId)
        
      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' })
        }
    }
  } catch (error) {
    console.error('Team Lambda error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Internal server error' })
    }
  }
}

async function getTeamMembers(organizationId) {
  const params = {
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `ORG#${organizationId}`,
      ':sk': 'MEMBER#'
    }
  }
  
  const result = await dynamodb.query(params).promise()
  
  const members = result.Items.map(item => ({
    id: item.SK.replace('MEMBER#', ''),
    name: item.name,
    email: item.email,
    role: item.role,
    status: item.status,
    avatar: item.avatar,
    joinedAt: item.joinedAt,
    lastActive: item.lastActive,
    invitedBy: item.invitedBy,
    permissions: item.permissions
  }))
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(members)
  }
}

async function getTeamMember(organizationId, memberId) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `ORG#${organizationId}`,
      SK: `MEMBER#${memberId}`
    }
  }
  
  const result = await dynamodb.get(params).promise()
  
  if (!result.Item) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Team member not found' })
    }
  }
  
  const member = {
    id: memberId,
    name: result.Item.name,
    email: result.Item.email,
    role: result.Item.role,
    status: result.Item.status,
    avatar: result.Item.avatar,
    joinedAt: result.Item.joinedAt,
    lastActive: result.Item.lastActive,
    invitedBy: result.Item.invitedBy,
    permissions: result.Item.permissions
  }
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(member)
  }
}

async function inviteTeamMember(organizationId, inviteData, invitedBy) {
  const memberId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const timestamp = new Date().toISOString()
  
  // Create invitation record
  const invitationParams = {
    TableName: TABLE_NAME,
    Item: {
      PK: `ORG#${organizationId}`,
      SK: `INVITATION#${memberId}`,
      email: inviteData.email,
      role: inviteData.role || 'viewer',
      invitedBy,
      invitedAt: timestamp,
      status: 'pending',
      message: inviteData.message,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    }
  }
  
  await dynamodb.put(invitationParams).promise()
  
  // Send invitation email
  try {
    const inviterName = event.requestContext?.authorizer?.claims?.name || 'A team member'
    
    await emailService.sendTeamInvitation({
      email,
      inviterName,
      organizationName: organizationName || organizationId,
      role,
      invitationToken: memberId
    })
    console.log('Invitation email sent to:', email)
  } catch (emailError) {
    console.error('Failed to send invitation email:', emailError)
    // Continue even if email fails - invitation is still created
  }
  
  return {
    statusCode: 201,
    headers,
    body: JSON.stringify({
      success: true,
      invitationId: memberId,
      message: 'Invitation sent successfully'
    })
  }
}

async function updateTeamMember(organizationId, memberId, updateData) {
  // Build update expression
  const updateExpressions = []
  const expressionAttributeNames = {}
  const expressionAttributeValues = {}
  
  if (updateData.role) {
    updateExpressions.push('#role = :role')
    expressionAttributeNames['#role'] = 'role'
    expressionAttributeValues[':role'] = updateData.role
  }
  
  if (updateData.status) {
    updateExpressions.push('#status = :status')
    expressionAttributeNames['#status'] = 'status'
    expressionAttributeValues[':status'] = updateData.status
  }
  
  if (updateData.permissions) {
    updateExpressions.push('permissions = :permissions')
    expressionAttributeValues[':permissions'] = updateData.permissions
  }
  
  updateExpressions.push('updatedAt = :updatedAt')
  expressionAttributeValues[':updatedAt'] = new Date().toISOString()
  
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `ORG#${organizationId}`,
      SK: `MEMBER#${memberId}`
    },
    UpdateExpression: 'SET ' + updateExpressions.join(', '),
    ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
    ExpressionAttributeValues,
    ReturnValues: 'ALL_NEW'
  }
  
  const result = await dynamodb.update(params).promise()
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      member: {
        id: memberId,
        ...result.Attributes
      }
    })
  }
}

async function removeTeamMember(organizationId, memberId, removedBy) {
  // First, get the member details for audit
  const getMemberParams = {
    TableName: TABLE_NAME,
    Key: {
      PK: `ORG#${organizationId}`,
      SK: `MEMBER#${memberId}`
    }
  }
  
  const memberResult = await dynamodb.get(getMemberParams).promise()
  
  if (!memberResult.Item) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Team member not found' })
    }
  }
  
  // Check if trying to remove owner
  if (memberResult.Item.role === 'owner') {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: 'Cannot remove organization owner' })
    }
  }
  
  // Archive member record (soft delete)
  const archiveParams = {
    TableName: TABLE_NAME,
    Item: {
      ...memberResult.Item,
      PK: `ORG#${organizationId}`,
      SK: `ARCHIVED_MEMBER#${memberId}`,
      archivedAt: new Date().toISOString(),
      archivedBy: removedBy
    }
  }
  
  await dynamodb.put(archiveParams).promise()
  
  // Delete active member record
  const deleteParams = {
    TableName: TABLE_NAME,
    Key: {
      PK: `ORG#${organizationId}`,
      SK: `MEMBER#${memberId}`
    }
  }
  
  await dynamodb.delete(deleteParams).promise()
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      message: 'Team member removed successfully'
    })
  }
}