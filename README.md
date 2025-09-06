# PodcastFlow Pro

Next-generation podcast advertising management platform built with AWS serverless architecture, Next.js 14, and TypeScript.

## Overview

PodcastFlow Pro is a comprehensive solution that streamlines the entire podcast advertising workflow - from campaign creation and management to financial tracking and reporting. The platform provides deep integrations with 22+ third-party platforms and delivers:

- 88% reduction in accounts receivable/payable processing time
- Error prevention worth 1.67% of annual revenue
- 453.33% ROI for mid-sized podcast networks
- Real-time synchronization across multiple platforms

## Tech Stack

### Frontend
- **Framework**: Next.js 14 with TypeScript
- **UI Components**: Material-UI v5
- **State Management**: Redux Toolkit + React Query
- **Authentication**: AWS Amplify Auth
- **Styling**: Tailwind CSS + Emotion

### Backend
- **API**: AWS API Gateway (REST)
- **Compute**: AWS Lambda
- **Database**: DynamoDB (single-table design)
- **Authentication**: AWS Cognito
- **Storage**: S3
- **Cache**: ElastiCache Redis
- **Analytics**: Amazon Redshift Serverless

## Project Structure

```
podcastflow-pro/
├── src/
│   ├── app/              # Next.js app directory
│   ├── components/       # Reusable React components
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Library configurations
│   ├── services/        # API service layers
│   ├── store/           # Redux store and slices
│   ├── types/           # TypeScript type definitions
│   └── utils/           # Utility functions
├── infrastructure/
│   ├── cloudformation/  # AWS CloudFormation templates
│   ├── lambdas/        # Lambda function code
│   └── scripts/        # Deployment scripts
├── public/             # Static assets
└── tests/              # Test files

```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- AWS CLI configured with appropriate credentials
- AWS SAM CLI (for local Lambda development)

### Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd podcastflow-pro
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp .env.example .env.local
```

4. Configure environment variables in `.env.local`

### Development

Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Building

Build for production:
```bash
npm run build
```

### Testing

Run tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

Type checking:
```bash
npm run typecheck
```

## Deployment

### Infrastructure Deployment

1. Navigate to infrastructure directory:
```bash
cd infrastructure/scripts
```

2. Run deployment script:
```bash
./deploy.sh
```

The script will:
- Package Lambda functions
- Deploy CloudFormation stack
- Output API endpoints and resource IDs

### Frontend Deployment

The frontend can be deployed to AWS Amplify:

```bash
amplify init
amplify push
```

## Key Features

### Campaign Management
- Create, edit, and manage advertising campaigns
- Media plan management with digital signatures
- Ad copy management with templates
- Advanced calendar view with conflict detection
- Real-time collaboration

### Financial Management
- Invoice generation and management
- Payment processing via Stripe
- Multi-currency support
- Automated reconciliation
- Advanced reporting

### Integrations (22+ platforms)
- **Tier 1**: HubSpot, Airtable, Megaphone, Stripe, Google Workspace, Slack
- **Tier 2**: Salesforce, Art19, Spotify for Podcasters, Zapier, Microsoft Teams
- **Tier 3**: Pipedrive, Notion, Apple Podcasts Connect, Discord

### Analytics & Reporting
- Custom dashboard builder
- Real-time performance metrics
- Predictive analytics
- Export capabilities

## API Documentation

API endpoints follow RESTful conventions:

- `GET /campaigns` - List campaigns
- `POST /campaigns` - Create campaign
- `GET /campaigns/{id}` - Get campaign details
- `PUT /campaigns/{id}` - Update campaign
- `DELETE /campaigns/{id}` - Delete campaign

All endpoints require JWT authentication via Cognito.

## Security

- JWT token-based authentication
- Role-based access control (RBAC)
- Data encryption at rest and in transit
- AWS Secrets Manager for API keys
- Regular security audits

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

Proprietary - All rights reserved

## Support

For support, email support@podcastflowpro.com