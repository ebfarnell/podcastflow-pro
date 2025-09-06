import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'

// Initialize DynamoDB client
const client = new DynamoDBClient({
  region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1',
})

// Create document client
export const dynamodb = DynamoDBDocumentClient.from(client)

// Table names
export const TABLES = {
  ORGANIZATIONS: process.env.DYNAMODB_TABLE_NAME || 'PodcastFlowPro',
  USERS: process.env.DYNAMODB_TABLE_NAME || 'PodcastFlowPro',
  CAMPAIGNS: process.env.DYNAMODB_TABLE_NAME || 'PodcastFlowPro',
  NOTIFICATIONS: process.env.DYNAMODB_TABLE_NAME || 'PodcastFlowPro',
  SETTINGS: process.env.DYNAMODB_TABLE_NAME || 'PodcastFlowPro',
  SHOWS: process.env.DYNAMODB_TABLE_NAME || 'PodcastFlowPro',
  EPISODES: process.env.DYNAMODB_TABLE_NAME || 'PodcastFlowPro',
}

// Helper to add type prefix to IDs
export const prefixId = (type: string, id: string) => `${type}#${id}`

// Helper to remove type prefix from IDs
export const unprefixId = (prefixedId: string) => {
  const parts = prefixedId.split('#')
  return parts.length > 1 ? parts[1] : prefixedId
}

// Common DynamoDB operations
export const db = {
  async scan(tableName: string, filter?: any) {
    const command = new ScanCommand({
      TableName: tableName,
      ...filter
    })
    return dynamodb.send(command)
  },

  async query(tableName: string, params: any) {
    const command = new QueryCommand({
      TableName: tableName,
      ...params
    })
    return dynamodb.send(command)
  },

  async get(tableName: string, key: any) {
    const command = new GetCommand({
      TableName: tableName,
      Key: key
    })
    return dynamodb.send(command)
  },

  async put(tableName: string, item: any) {
    const command = new PutCommand({
      TableName: tableName,
      Item: {
        ...item,
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    })
    return dynamodb.send(command)
  },

  async update(tableName: string, key: any, updates: any) {
    const updateExpressions: string[] = []
    const expressionAttributeNames: any = {}
    const expressionAttributeValues: any = {}

    Object.entries(updates).forEach(([field, value], index) => {
      const placeholder = `#field${index}`
      const valuePlaceholder = `:value${index}`
      
      updateExpressions.push(`${placeholder} = ${valuePlaceholder}`)
      expressionAttributeNames[placeholder] = field
      expressionAttributeValues[valuePlaceholder] = value
    })

    // Always update the updatedAt timestamp
    updateExpressions.push('#updatedAt = :updatedAt')
    expressionAttributeNames['#updatedAt'] = 'updatedAt'
    expressionAttributeValues[':updatedAt'] = new Date().toISOString()

    const command = new UpdateCommand({
      TableName: tableName,
      Key: key,
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    })
    
    return dynamodb.send(command)
  },

  async delete(tableName: string, key: any) {
    const command = new DeleteCommand({
      TableName: tableName,
      Key: key
    })
    return dynamodb.send(command)
  }
}