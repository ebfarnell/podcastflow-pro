#!/bin/bash

# Production setup script for PodcastFlow Pro
# This script sets up HTTPS, custom domain, and production infrastructure

set -e

echo "==================================="
echo "PodcastFlow Pro - Production Setup"
echo "==================================="

# Configuration
DOMAIN_NAME=${1:-"app.podcastflow.pro"}
BASE_DOMAIN="podcastflow.pro"
REGION="us-east-1"
STACK_NAME="podcastflow-production"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}This script will set up:${NC}"
echo "1. SSL Certificate with AWS Certificate Manager"
echo "2. CloudFront Distribution for HTTPS"
echo "3. Route 53 Hosted Zone (if domain is provided)"
echo "4. API Gateway Custom Domain"
echo "5. Production security settings"
echo ""
echo -e "${YELLOW}Domain: ${DOMAIN_NAME}${NC}"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    exit 1
fi

# Step 1: Create SSL Certificate
echo -e "\n${GREEN}Step 1: Creating SSL Certificate...${NC}"
CERT_ARN=$(aws acm request-certificate \
    --domain-name ${DOMAIN_NAME} \
    --subject-alternative-names "*.${DOMAIN_NAME}" \
    --validation-method DNS \
    --region us-east-1 \
    --query CertificateArn \
    --output text)

echo "Certificate ARN: ${CERT_ARN}"
echo -e "${YELLOW}NOTE: You must validate the certificate via DNS before proceeding${NC}"

# Step 2: Create CloudFormation template for production infrastructure
echo -e "\n${GREEN}Step 2: Creating Production Infrastructure...${NC}"
cat > /tmp/production-stack.yaml << EOF
AWSTemplateFormatVersion: '2010-09-09'
Description: PodcastFlow Pro Production Infrastructure

Parameters:
  DomainName:
    Type: String
    Default: ${DOMAIN_NAME}
  CertificateArn:
    Type: String
    Default: ${CERT_ARN}
  ApiEndpoint:
    Type: String
    Default: https://9uiib4zrdb.execute-api.us-east-1.amazonaws.com/prod

Resources:
  # S3 Bucket for static assets
  StaticAssetsBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub '\${DomainName}-assets'
      PublicAccessBlockConfiguration:
        BlockPublicAcls: false
        BlockPublicPolicy: false
        IgnorePublicAcls: false
        RestrictPublicBuckets: false
      WebsiteConfiguration:
        IndexDocument: index.html
        ErrorDocument: error.html
      CorsConfiguration:
        CorsRules:
          - AllowedHeaders: ['*']
            AllowedMethods: [GET, HEAD]
            AllowedOrigins: ['*']
            MaxAge: 3600

  # Bucket Policy
  StaticAssetsBucketPolicy:
    Type: AWS::S3::BucketPolicy
    Properties:
      Bucket: !Ref StaticAssetsBucket
      PolicyDocument:
        Statement:
          - Sid: PublicReadGetObject
            Effect: Allow
            Principal: '*'
            Action: 's3:GetObject'
            Resource: !Sub '\${StaticAssetsBucket.Arn}/*'

  # CloudFront Distribution
  CloudFrontDistribution:
    Type: AWS::CloudFront::Distribution
    Properties:
      DistributionConfig:
        Enabled: true
        Comment: PodcastFlow Pro CDN
        DefaultRootObject: index.html
        Aliases:
          - !Ref DomainName
        ViewerCertificate:
          AcmCertificateArn: !Ref CertificateArn
          SslSupportMethod: sni-only
          MinimumProtocolVersion: TLSv1.2_2021
        Origins:
          # Origin for Next.js application
          - Id: NextJsOrigin
            DomainName: !Sub '\${AWS::StackName}-alb.us-east-1.elb.amazonaws.com'
            CustomOriginConfig:
              OriginProtocolPolicy: http-only
              HTTPPort: 3001
          # Origin for API Gateway
          - Id: ApiGatewayOrigin
            DomainName: !Select [2, !Split ['/', !Ref ApiEndpoint]]
            CustomOriginConfig:
              OriginProtocolPolicy: https-only
              HTTPSPort: 443
          # Origin for static assets
          - Id: S3Origin
            DomainName: !GetAtt StaticAssetsBucket.RegionalDomainName
            S3OriginConfig:
              OriginAccessIdentity: ''
        DefaultCacheBehavior:
          TargetOriginId: NextJsOrigin
          ViewerProtocolPolicy: redirect-to-https
          AllowedMethods: [GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE]
          CachedMethods: [GET, HEAD]
          ForwardedValues:
            QueryString: true
            Cookies:
              Forward: all
            Headers:
              - Authorization
              - Host
              - CloudFront-Forwarded-Proto
          Compress: true
        CacheBehaviors:
          # API routes
          - PathPattern: /api/*
            TargetOriginId: ApiGatewayOrigin
            ViewerProtocolPolicy: https-only
            AllowedMethods: [GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE]
            ForwardedValues:
              QueryString: true
              Headers:
                - Authorization
                - Content-Type
                - X-Amz-Date
                - X-Api-Key
                - X-Amz-Security-Token
              Cookies:
                Forward: none
          # Static assets
          - PathPattern: /_next/static/*
            TargetOriginId: S3Origin
            ViewerProtocolPolicy: https-only
            AllowedMethods: [GET, HEAD]
            CachedMethods: [GET, HEAD]
            ForwardedValues:
              QueryString: false
              Cookies:
                Forward: none
            Compress: true
            DefaultTTL: 86400
            MaxTTL: 31536000
        PriceClass: PriceClass_100
        HttpVersion: http2
        IPV6Enabled: true

  # WAF WebACL
  WebACL:
    Type: AWS::WAFv2::WebACL
    Properties:
      Name: PodcastFlowProWebACL
      Scope: CLOUDFRONT
      DefaultAction:
        Allow: {}
      Rules:
        - Name: RateLimitRule
          Priority: 1
          Action:
            Block: {}
          Statement:
            RateBasedStatement:
              Limit: 2000
              AggregateKeyType: IP
          VisibilityConfig:
            SampledRequestsEnabled: true
            CloudWatchMetricsEnabled: true
            MetricName: RateLimitRule
        - Name: CommonAttackProtection
          Priority: 2
          OverrideAction:
            None: {}
          Statement:
            ManagedRuleGroupStatement:
              VendorName: AWS
              Name: AWSManagedRulesCommonRuleSet
          VisibilityConfig:
            SampledRequestsEnabled: true
            CloudWatchMetricsEnabled: true
            MetricName: CommonAttackProtection
      VisibilityConfig:
        SampledRequestsEnabled: true
        CloudWatchMetricsEnabled: true
        MetricName: PodcastFlowProWebACL

  # Route 53 Hosted Zone (if not exists)
  HostedZone:
    Type: AWS::Route53::HostedZone
    Properties:
      Name: !Ref DomainName
      HostedZoneConfig:
        Comment: PodcastFlow Pro Domain

  # Route 53 Records
  DNSRecords:
    Type: AWS::Route53::RecordSetGroup
    Properties:
      HostedZoneId: !Ref HostedZone
      RecordSets:
        - Name: !Ref DomainName
          Type: A
          AliasTarget:
            DNSName: !GetAtt CloudFrontDistribution.DomainName
            HostedZoneId: Z2FDTNDATAQYW2 # CloudFront Hosted Zone ID

Outputs:
  CloudFrontURL:
    Description: CloudFront Distribution URL
    Value: !Sub 'https://\${CloudFrontDistribution.DomainName}'
  DomainURL:
    Description: Production Domain URL
    Value: !Sub 'https://\${DomainName}'
  StaticAssetsBucket:
    Description: S3 Bucket for static assets
    Value: !Ref StaticAssetsBucket
  NameServers:
    Description: Route 53 Name Servers (update your domain registrar)
    Value: !Join [', ', !GetAtt HostedZone.NameServers]
EOF

# Deploy the production stack
echo -e "\n${GREEN}Deploying production infrastructure...${NC}"
aws cloudformation deploy \
    --template-file /tmp/production-stack.yaml \
    --stack-name ${STACK_NAME} \
    --parameter-overrides \
        DomainName=${DOMAIN_NAME} \
        CertificateArn=${CERT_ARN} \
    --capabilities CAPABILITY_IAM \
    --region ${REGION} || echo -e "${RED}Stack deployment failed. Certificate may need validation.${NC}"

echo -e "\n${GREEN}Step 3: Setting up API Gateway Custom Domain...${NC}"
# Create API Gateway custom domain
aws apigateway create-domain-name \
    --domain-name api.${DOMAIN_NAME} \
    --regional-certificate-arn ${CERT_ARN} \
    --security-policy TLS_1_2 \
    --region ${REGION} || echo "Domain may already exist"

# Get API Gateway ID
API_ID=$(aws apigateway get-rest-apis \
    --query "items[?name=='PodcastFlow-Pro-API'].id" \
    --output text \
    --region ${REGION})

if [ -n "$API_ID" ]; then
    # Create base path mapping
    aws apigateway create-base-path-mapping \
        --domain-name api.${DOMAIN_NAME} \
        --rest-api-id ${API_ID} \
        --stage prod \
        --region ${REGION} || echo "Mapping may already exist"
fi

echo -e "\n${GREEN}Step 4: Updating Environment Configuration...${NC}"
# Update .env.local with production settings
cat > ../../.env.production << EOF
# Production Environment Configuration
NEXT_PUBLIC_API_ENDPOINT=https://api.${DOMAIN_NAME}
NEXT_PUBLIC_APP_URL=https://${DOMAIN_NAME}
NEXT_PUBLIC_ENVIRONMENT=production

# AWS Configuration (to be moved to Secrets Manager)
NEXT_PUBLIC_AWS_REGION=${REGION}
NEXT_PUBLIC_USER_POOL_ID=$(grep NEXT_PUBLIC_USER_POOL_ID ../../.env.local | cut -d '=' -f2)
NEXT_PUBLIC_USER_POOL_CLIENT_ID=$(grep NEXT_PUBLIC_USER_POOL_CLIENT_ID ../../.env.local | cut -d '=' -f2)

# Features
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_ERROR_TRACKING=true
EOF

echo -e "\n${GREEN}Production setup partially complete!${NC}"
echo -e "\n${YELLOW}Next Steps:${NC}"
echo "1. Validate the SSL certificate in AWS Certificate Manager"
echo "2. Update your domain's nameservers to:"
aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --query "Stacks[0].Outputs[?OutputKey=='NameServers'].OutputValue" \
    --output text 2>/dev/null || echo "   (Stack still deploying, check CloudFormation console)"
echo "3. Run the secrets manager setup script"
echo "4. Deploy the application in production mode"
echo ""
echo -e "${RED}IMPORTANT: Do not proceed until SSL certificate is validated!${NC}"