# PodcastFlow Pro - System Documentation

## Overview

PodcastFlow Pro is a comprehensive multi-role podcast advertising platform built with Next.js, AWS Lambda, DynamoDB, and real-time WebSocket capabilities. The system supports five distinct user roles with granular permissions and features real-time collaboration, automated backups, and comprehensive monitoring.

## Architecture

### Frontend
- **Framework**: Next.js 14 with TypeScript
- **UI Library**: Material-UI (MUI)
- **State Management**: React Query & Context API
- **Authentication**: AWS Cognito
- **Real-time**: WebSocket connections

### Backend
- **Compute**: AWS Lambda (Node.js 18.x)
- **Database**: DynamoDB (Single-table design)
- **API**: API Gateway REST & WebSocket
- **Storage**: S3 for backups and media
- **Authentication**: JWT with Cognito

### Infrastructure
- **Region**: us-east-1
- **Monitoring**: CloudWatch
- **Backups**: S3 with automated scheduling
- **Security**: WAF, rate limiting, input validation

## User Roles & Permissions

### 1. Admin
- Full system access
- User management
- Permission management
- System monitoring
- Backup/restore operations
- All entity CRUD operations

### 2. Seller
- Campaign management
- Client management
- View analytics
- Manage assigned clients

### 3. Producer
- Show management
- Episode scheduling
- Talent assignment
- View show analytics

### 4. Talent
- View assigned episodes
- Update availability
- View schedule
- Recording management

### 5. Client
- View campaigns
- View reports
- Billing access
- Limited analytics

## Key Features

### 1. Account Teams
- Collaborative campaign management
- Role-based team assignments
- Granular permissions per team member
- Real-time updates

### 2. Real-time Synchronization
- WebSocket-based updates
- Automatic UI refresh
- Conflict resolution
- Presence indicators

### 3. Notification System
- Real-time notifications
- Email integration
- Priority levels
- Batch operations

### 4. Activity Logging
- Complete audit trail
- Entity-based tracking
- User action history
- 90-day retention

### 5. Backup & Restore
- Manual and scheduled backups
- Downloadable backups
- Selective restore
- Automated retention policies

### 6. Monitoring & Alerting
- Real-time system health
- Performance metrics
- Automated alerts
- Service-level monitoring

## Database Schema

### Single Table Design
```
Primary Key (PK) | Sort Key (SK) | GSI1PK | GSI1SK | Attributes
-----------------|---------------|---------|---------|------------
USER#<id>        | METADATA      | USER    | <email> | user data
CAMPAIGN#<id>    | METADATA      | CAMPAIGN| <date>  | campaign data
SHOW#<id>        | METADATA      | SHOW    | <name>  | show data
EPISODE#<id>     | METADATA      | EPISODE | <date>  | episode data
CLIENT#<id>      | METADATA      | CLIENT  | <name>  | client data
```

### Access Patterns
1. Get entity by ID
2. List entities by type
3. Query by GSI (email, date, name)
4. Filter by attributes

## API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `POST /auth/refresh` - Refresh token

### Users
- `GET /users` - List users
- `GET /users/{userId}` - Get user
- `POST /users` - Create user
- `PUT /users/{userId}` - Update user
- `DELETE /users/{userId}` - Delete user

### Campaigns
- `GET /campaigns` - List campaigns
- `GET /campaigns/{campaignId}` - Get campaign
- `POST /campaigns` - Create campaign
- `PUT /campaigns/{campaignId}` - Update campaign
- `DELETE /campaigns/{campaignId}` - Delete campaign
- `POST /campaigns/{campaignId}/team` - Add team member
- `DELETE /campaigns/{campaignId}/team/{userId}` - Remove team member

### Shows
- `GET /shows` - List shows
- `GET /shows/{showId}` - Get show
- `POST /shows` - Create show
- `PUT /shows/{showId}` - Update show
- `DELETE /shows/{showId}` - Delete show

### Episodes
- `GET /episodes` - List episodes
- `GET /episodes/{episodeId}` - Get episode
- `POST /episodes` - Create episode
- `PUT /episodes/{episodeId}` - Update episode
- `DELETE /episodes/{episodeId}` - Delete episode

### Clients
- `GET /clients` - List clients
- `GET /clients/{clientId}` - Get client
- `POST /clients` - Create client
- `PUT /clients/{clientId}` - Update client
- `DELETE /clients/{clientId}` - Delete client

### Notifications
- `GET /notifications` - List notifications
- `POST /notifications/{notificationId}/read` - Mark as read
- `POST /notifications/batch-read` - Batch mark as read

### Activities
- `GET /activities` - List activities
- `GET /activities/{activityId}` - Get activity
- `POST /activities` - Log activity

### Backups
- `GET /backups` - List backups
- `POST /backups` - Create backup
- `POST /backups/restore` - Restore from backup
- `GET /backups/{backupId}/download` - Download backup
- `PUT /backups/schedule` - Update backup schedule

### Monitoring
- `GET /monitoring/health` - System health
- `GET /monitoring/metrics` - Performance metrics
- `GET /monitoring/alerts` - Active alerts

## Security

### Authentication
- JWT tokens with 24-hour expiration
- Refresh token rotation
- Session management
- MFA support (optional)

### Authorization
- Role-based access control (RBAC)
- Granular permissions
- Resource-level permissions
- API key support

### Data Protection
- Encryption at rest (DynamoDB)
- Encryption in transit (TLS)
- Input validation
- SQL injection prevention
- XSS protection

### Rate Limiting
- Per-role limits
- Per-endpoint limits
- IP-based throttling
- API key quotas

## Deployment

### Prerequisites
1. AWS Account with appropriate permissions
2. Node.js 18.x installed
3. AWS CLI configured
4. Git repository access

### Backend Deployment
```bash
# Deploy all Lambda functions
cd infrastructure/scripts
./deploy-all-lambdas.sh

# Deploy specific service
./deploy-single-lambda.sh <service-name>

# Configure API endpoints
./configure-all-apis.sh
```

### Frontend Deployment
```bash
# Install dependencies
npm install

# Build production bundle
npm run build

# Deploy to hosting service
npm run deploy
```

### Environment Variables
```
# Backend
TABLE_NAME=PodcastFlowPro
REGION=us-east-1
SENDER_EMAIL=noreply@podcastflowpro.com
WEBSOCKET_API_URL=wss://your-websocket-url
BACKUP_BUCKET=podcastflowpro-backups

# Frontend
NEXT_PUBLIC_API_ENDPOINT=https://your-api-url/prod
NEXT_PUBLIC_WEBSOCKET_URL=wss://your-websocket-url
NEXT_PUBLIC_USER_POOL_ID=your-cognito-pool-id
NEXT_PUBLIC_USER_POOL_CLIENT_ID=your-cognito-client-id
```

## Monitoring

### CloudWatch Metrics
- API Gateway: Request count, latency, errors
- Lambda: Invocations, duration, errors, throttles
- DynamoDB: Read/write capacity, throttles
- Custom metrics: User activity, business metrics

### Alarms
- High error rate (>5%)
- High latency (>1000ms)
- DynamoDB throttling
- Lambda errors
- Low system health

### Dashboards
- System overview
- Service health
- Performance metrics
- Business metrics

## Backup & Recovery

### Backup Strategy
- **Daily**: 7-day retention
- **Weekly**: 30-day retention
- **Monthly**: 365-day retention

### Backup Contents
- All DynamoDB data
- User configurations
- System settings
- Activity logs

### Recovery Process
1. Select backup from list
2. Choose entities to restore
3. Confirm restoration
4. Monitor progress
5. Verify data integrity

## Maintenance

### Regular Tasks
1. **Daily**
   - Monitor system health
   - Check active alerts
   - Review error logs

2. **Weekly**
   - Review backup status
   - Check security alerts
   - Performance analysis

3. **Monthly**
   - Update dependencies
   - Security patches
   - Cost optimization
   - User access review

### Troubleshooting

#### Common Issues
1. **High Latency**
   - Check Lambda cold starts
   - Review DynamoDB capacity
   - Analyze API Gateway metrics

2. **Authentication Errors**
   - Verify Cognito configuration
   - Check JWT expiration
   - Review CORS settings

3. **Data Inconsistency**
   - Check DynamoDB transactions
   - Review Lambda error logs
   - Verify WebSocket connections

## Support

### Logging
- CloudWatch Logs for all Lambda functions
- Structured logging with correlation IDs
- Error tracking with stack traces
- Performance logging

### Debugging
1. Enable debug mode in Lambda environment
2. Use CloudWatch Insights for log analysis
3. X-Ray tracing for request flow
4. Local development with SAM CLI

### Contact
- Technical Issues: File a GitHub issue
- Security Concerns: security@podcastflowpro.com
- General Support: support@podcastflowpro.com

## Best Practices

### Development
1. Use TypeScript for type safety
2. Follow ESLint rules
3. Write unit tests
4. Document API changes
5. Use semantic versioning

### Security
1. Regular security audits
2. Dependency updates
3. Penetration testing
4. Access reviews
5. Incident response plan

### Performance
1. Optimize Lambda package size
2. Use DynamoDB efficiently
3. Implement caching
4. Monitor cold starts
5. Regular load testing

## Future Enhancements

### Planned Features
1. Advanced analytics dashboard
2. Machine learning recommendations
3. Mobile application
4. Third-party integrations
5. Advanced reporting

### Technical Improvements
1. Multi-region deployment
2. GraphQL API
3. Elasticsearch integration
4. Redis caching
5. Kubernetes migration