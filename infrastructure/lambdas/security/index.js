const AWS = require('aws-sdk')
const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const speakeasy = require('speakeasy')
const QRCode = require('qrcode')

const dynamodb = new AWS.DynamoDB.DocumentClient()
const cognito = new AWS.CognitoIdentityServiceProvider()

const TABLE_NAME = process.env.TABLE_NAME || 'PodcastFlowPro'
const USER_POOL_ID = process.env.USER_POOL_ID

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
}

exports.handler = async (event) => {
  console.log('Security Lambda received event:', JSON.stringify(event))
  
  const { httpMethod, path, body, requestContext } = event
  
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
    const email = requestContext?.authorizer?.claims?.email || 'test@example.com'
    
    // Route based on path
    if (path.includes('/password')) {
      return await handlePasswordOperations(httpMethod, body, userId)
    } else if (path.includes('/2fa')) {
      return await handleTwoFactorOperations(httpMethod, body, userId, email)
    } else if (path.includes('/sessions')) {
      return await handleSessionOperations(httpMethod, body, userId)
    } else if (path.includes('/preferences')) {
      return await handleSecurityPreferences(httpMethod, body, userId)
    } else {
      // GET /security - return all security settings
      return await getSecuritySettings(userId)
    }
  } catch (error) {
    console.error('Security Lambda error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Internal server error' })
    }
  }
}

async function getSecuritySettings(userId) {
  // Get user security settings
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `USER#${userId}`,
      SK: 'SECURITY'
    }
  }
  
  const result = await dynamodb.get(params).promise()
  
  // Get active sessions
  const sessionParams = {
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}`,
      ':sk': 'SESSION#'
    }
  }
  
  const sessionsResult = await dynamodb.query(sessionParams).promise()
  
  const settings = result.Item || {
    twoFactorEnabled: false,
    passwordLastChanged: new Date().toISOString(),
    loginAlerts: true,
    suspiciousActivityAlerts: true
  }
  
  const sessions = sessionsResult.Items.map(session => ({
    id: session.SK.replace('SESSION#', ''),
    device: session.device,
    browser: session.browser,
    location: session.location,
    lastActive: session.lastActive,
    isCurrent: session.sessionId === requestContext?.requestId
  }))
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      ...settings,
      sessions
    })
  }
}

async function handlePasswordOperations(httpMethod, body, userId) {
  if (httpMethod !== 'PUT') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }
  
  const { currentPassword, newPassword } = JSON.parse(body)
  
  // Validate password strength
  if (newPassword.length < 8) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Password must be at least 8 characters long' })
    }
  }
  
  try {
    // Update password in Cognito
    if (USER_POOL_ID) {
      const cognitoParams = {
        UserPoolId: USER_POOL_ID,
        Username: userId,
        Password: newPassword,
        Permanent: true
      }
      
      await cognito.adminSetUserPassword(cognitoParams).promise()
    }
    
    // Update password metadata in DynamoDB
    const updateParams = {
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: 'SECURITY'
      },
      UpdateExpression: 'SET passwordLastChanged = :timestamp, updatedAt = :timestamp',
      ExpressionAttributeValues: {
        ':timestamp': new Date().toISOString()
      }
    }
    
    await dynamodb.update(updateParams).promise()
    
    // TODO: Send password change notification email
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Password updated successfully'
      })
    }
  } catch (error) {
    console.error('Password update error:', error)
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Failed to update password' })
    }
  }
}

async function handleTwoFactorOperations(httpMethod, body, userId, email) {
  const parsedBody = body ? JSON.parse(body) : {}
  
  switch (httpMethod) {
    case 'GET':
      // Get 2FA status
      const settingsParams = {
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: 'SECURITY'
        }
      }
      
      const settingsResult = await dynamodb.get(settingsParams).promise()
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          enabled: settingsResult.Item?.twoFactorEnabled || false
        })
      }
      
    case 'POST':
      // Enable 2FA - generate secret and QR code
      const secret = speakeasy.generateSecret({
        name: `PodcastFlow Pro (${email})`,
        length: 32
      })
      
      // Store secret temporarily (encrypted)
      const tempParams = {
        TableName: TABLE_NAME,
        Item: {
          PK: `USER#${userId}`,
          SK: 'TEMP_2FA_SECRET',
          secret: secret.base32,
          createdAt: new Date().toISOString(),
          TTL: Math.floor(Date.now() / 1000) + 600 // Expires in 10 minutes
        }
      }
      
      await dynamodb.put(tempParams).promise()
      
      // Generate QR code
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url)
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          qrCode: qrCodeUrl,
          secret: secret.base32
        })
      }
      
    case 'PUT':
      // Verify 2FA code and enable
      const { verificationCode } = parsedBody
      
      // Get temporary secret
      const getTempParams = {
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: 'TEMP_2FA_SECRET'
        }
      }
      
      const tempResult = await dynamodb.get(getTempParams).promise()
      
      if (!tempResult.Item) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: '2FA setup expired. Please start again.' })
        }
      }
      
      // Verify the code
      const verified = speakeasy.totp.verify({
        secret: tempResult.Item.secret,
        encoding: 'base32',
        token: verificationCode,
        window: 2
      })
      
      if (!verified) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid verification code' })
        }
      }
      
      // Enable 2FA and store encrypted secret
      const enableParams = {
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: 'SECURITY'
        },
        UpdateExpression: 'SET twoFactorEnabled = :enabled, twoFactorSecret = :secret, updatedAt = :timestamp',
        ExpressionAttributeValues: {
          ':enabled': true,
          ':secret': encrypt(tempResult.Item.secret), // Encrypt before storing
          ':timestamp': new Date().toISOString()
        }
      }
      
      await dynamodb.update(enableParams).promise()
      
      // Clean up temporary secret
      const deleteParams = {
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: 'TEMP_2FA_SECRET'
        }
      }
      
      await dynamodb.delete(deleteParams).promise()
      
      // Generate backup codes
      const backupCodes = generateBackupCodes()
      
      // Store backup codes (hashed)
      const backupParams = {
        TableName: TABLE_NAME,
        Item: {
          PK: `USER#${userId}`,
          SK: 'BACKUP_CODES',
          codes: backupCodes.map(code => bcrypt.hashSync(code, 10)),
          createdAt: new Date().toISOString()
        }
      }
      
      await dynamodb.put(backupParams).promise()
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          backupCodes
        })
      }
      
    case 'DELETE':
      // Disable 2FA
      const disableParams = {
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: 'SECURITY'
        },
        UpdateExpression: 'SET twoFactorEnabled = :enabled, updatedAt = :timestamp REMOVE twoFactorSecret',
        ExpressionAttributeValues: {
          ':enabled': false,
          ':timestamp': new Date().toISOString()
        }
      }
      
      await dynamodb.update(disableParams).promise()
      
      // Remove backup codes
      const deleteBackupParams = {
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: 'BACKUP_CODES'
        }
      }
      
      await dynamodb.delete(deleteBackupParams).promise()
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: '2FA disabled successfully'
        })
      }
      
    default:
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
      }
  }
}

async function handleSessionOperations(httpMethod, body, userId) {
  switch (httpMethod) {
    case 'GET':
      // Get all sessions
      const params = {
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': 'SESSION#'
        }
      }
      
      const result = await dynamodb.query(params).promise()
      
      const sessions = result.Items.map(session => ({
        id: session.SK.replace('SESSION#', ''),
        device: session.device,
        browser: session.browser,
        location: session.location,
        lastActive: session.lastActive,
        createdAt: session.createdAt
      }))
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(sessions)
      }
      
    case 'DELETE':
      // Revoke session
      const { sessionId } = JSON.parse(body)
      
      const deleteParams = {
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: `SESSION#${sessionId}`
        }
      }
      
      await dynamodb.delete(deleteParams).promise()
      
      // TODO: Invalidate the session token
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Session revoked successfully'
        })
      }
      
    default:
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
      }
  }
}

async function handleSecurityPreferences(httpMethod, body, userId) {
  if (httpMethod !== 'PUT') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }
  
  const preferences = JSON.parse(body)
  
  const updateParams = {
    TableName: TABLE_NAME,
    Key: {
      PK: `USER#${userId}`,
      SK: 'SECURITY'
    },
    UpdateExpression: 'SET loginAlerts = :loginAlerts, suspiciousActivityAlerts = :suspiciousAlerts, updatedAt = :timestamp',
    ExpressionAttributeValues: {
      ':loginAlerts': preferences.loginAlerts,
      ':suspiciousAlerts': preferences.suspiciousActivityAlerts,
      ':timestamp': new Date().toISOString()
    }
  }
  
  await dynamodb.update(updateParams).promise()
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      message: 'Security preferences updated'
    })
  }
}

// Helper functions
function encrypt(text) {
  const algorithm = 'aes-256-gcm'
  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32)
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(algorithm, key, iv)
  
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const authTag = cipher.getAuthTag()
  
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted
}

function decrypt(text) {
  const algorithm = 'aes-256-gcm'
  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32)
  
  const parts = text.split(':')
  const iv = Buffer.from(parts[0], 'hex')
  const authTag = Buffer.from(parts[1], 'hex')
  const encrypted = parts[2]
  
  const decipher = crypto.createDecipheriv(algorithm, key, iv)
  decipher.setAuthTag(authTag)
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

function generateBackupCodes() {
  const codes = []
  for (let i = 0; i < 10; i++) {
    codes.push(crypto.randomBytes(4).toString('hex').toUpperCase())
  }
  return codes
}