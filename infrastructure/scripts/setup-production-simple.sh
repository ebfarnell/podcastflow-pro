#!/bin/bash

# Simplified production setup for app.podcastflow.pro
# This assumes you already have a Route 53 hosted zone for podcastflow.pro

set -e

echo "==========================================="
echo "PodcastFlow Pro - Production Setup"
echo "==========================================="
echo "Setting up: app.podcastflow.pro"
echo ""

# Configuration
SUBDOMAIN="app"
BASE_DOMAIN="podcastflow.pro"
FULL_DOMAIN="${SUBDOMAIN}.${BASE_DOMAIN}"
API_DOMAIN="api.${BASE_DOMAIN}"
REGION="us-east-1"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Step 1: Request SSL Certificate
echo -e "${GREEN}Step 1: Creating SSL Certificate...${NC}"
CERT_ARN=$(aws acm request-certificate \
    --domain-name "*.${BASE_DOMAIN}" \
    --subject-alternative-names "${BASE_DOMAIN}" \
    --validation-method DNS \
    --region us-east-1 \
    --query CertificateArn \
    --output text 2>/dev/null || echo "")

if [ -z "$CERT_ARN" ]; then
    # Certificate might already exist, let's find it
    CERT_ARN=$(aws acm list-certificates \
        --region us-east-1 \
        --query "CertificateSummaryList[?DomainName=='*.${BASE_DOMAIN}'].CertificateArn" \
        --output text)
fi

echo "Certificate ARN: ${CERT_ARN}"

# Step 2: Create Application Load Balancer for EC2
echo -e "\n${GREEN}Step 2: Setting up Application Load Balancer...${NC}"

# Get VPC and subnet information
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --query "Vpcs[0].VpcId" --output text)
SUBNET_IDS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=${VPC_ID}" --query "Subnets[?AvailabilityZone!='us-east-1e'].SubnetId" --output text)

# Create security group for ALB
echo "Creating security group for ALB..."
ALB_SG_ID=$(aws ec2 create-security-group \
    --group-name podcastflow-alb-sg \
    --description "Security group for PodcastFlow ALB" \
    --vpc-id ${VPC_ID} \
    --query GroupId \
    --output text 2>/dev/null || \
    aws ec2 describe-security-groups \
        --filters "Name=group-name,Values=podcastflow-alb-sg" \
        --query "SecurityGroups[0].GroupId" \
        --output text)

# Add rules to ALB security group
aws ec2 authorize-security-group-ingress \
    --group-id ${ALB_SG_ID} \
    --protocol tcp --port 443 --cidr 0.0.0.0/0 2>/dev/null || true
aws ec2 authorize-security-group-ingress \
    --group-id ${ALB_SG_ID} \
    --protocol tcp --port 80 --cidr 0.0.0.0/0 2>/dev/null || true

# Get EC2 instance ID
INSTANCE_ID=$(aws ec2 describe-instances \
    --filters "Name=instance-state-name,Values=running" \
    --query "Reservations[0].Instances[0].InstanceId" \
    --output text)

# Create target group
echo "Creating target group..."
TG_ARN=$(aws elbv2 create-target-group \
    --name podcastflow-tg \
    --protocol HTTP \
    --port 3001 \
    --vpc-id ${VPC_ID} \
    --health-check-path / \
    --health-check-interval-seconds 30 \
    --query "TargetGroups[0].TargetGroupArn" \
    --output text 2>/dev/null || \
    aws elbv2 describe-target-groups \
        --names podcastflow-tg \
        --query "TargetGroups[0].TargetGroupArn" \
        --output text)

# Register EC2 instance with target group
echo "Registering EC2 instance with target group..."
aws elbv2 register-targets \
    --target-group-arn ${TG_ARN} \
    --targets Id=${INSTANCE_ID}

# Create Application Load Balancer
echo "Creating Application Load Balancer..."
ALB_ARN=$(aws elbv2 create-load-balancer \
    --name podcastflow-alb \
    --subnets ${SUBNET_IDS} \
    --security-groups ${ALB_SG_ID} \
    --query "LoadBalancers[0].LoadBalancerArn" \
    --output text 2>/dev/null || \
    aws elbv2 describe-load-balancers \
        --names podcastflow-alb \
        --query "LoadBalancers[0].LoadBalancerArn" \
        --output text)

ALB_DNS=$(aws elbv2 describe-load-balancers \
    --load-balancer-arns ${ALB_ARN} \
    --query "LoadBalancers[0].DNSName" \
    --output text)

# Create HTTPS listener
echo "Creating HTTPS listener..."
aws elbv2 create-listener \
    --load-balancer-arn ${ALB_ARN} \
    --protocol HTTPS \
    --port 443 \
    --certificates CertificateArn=${CERT_ARN} \
    --default-actions Type=forward,TargetGroupArn=${TG_ARN} 2>/dev/null || \
    echo "HTTPS listener may already exist"

# Create HTTP to HTTPS redirect
echo "Creating HTTP redirect..."
aws elbv2 create-listener \
    --load-balancer-arn ${ALB_ARN} \
    --protocol HTTP \
    --port 80 \
    --default-actions Type=redirect,RedirectConfig="{Protocol=HTTPS,Port=443,StatusCode=HTTP_301}" 2>/dev/null || \
    echo "HTTP listener may already exist"

# Step 3: Update Route 53
echo -e "\n${GREEN}Step 3: Updating Route 53...${NC}"

# Get hosted zone ID
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
    --query "HostedZones[?Name=='${BASE_DOMAIN}.'].Id" \
    --output text | cut -d'/' -f3)

if [ -z "$HOSTED_ZONE_ID" ]; then
    echo -e "${RED}ERROR: No hosted zone found for ${BASE_DOMAIN}${NC}"
    echo "Please create a hosted zone for ${BASE_DOMAIN} first"
    exit 1
fi

# Create Route 53 record for app subdomain
echo "Creating DNS record for ${FULL_DOMAIN}..."
cat > /tmp/dns-record.json << EOF
{
    "Changes": [{
        "Action": "UPSERT",
        "ResourceRecordSet": {
            "Name": "${FULL_DOMAIN}",
            "Type": "A",
            "AliasTarget": {
                "HostedZoneId": "Z35SXDOTRQ7X7K",
                "DNSName": "${ALB_DNS}",
                "EvaluateTargetHealth": false
            }
        }
    }]
}
EOF

aws route53 change-resource-record-sets \
    --hosted-zone-id ${HOSTED_ZONE_ID} \
    --change-batch file:///tmp/dns-record.json

# Step 4: Set up API subdomain
echo -e "\n${GREEN}Step 4: Setting up API domain...${NC}"

# Create API Gateway custom domain
aws apigateway create-domain-name \
    --domain-name ${API_DOMAIN} \
    --regional-certificate-arn ${CERT_ARN} \
    --endpoint-configuration types=REGIONAL \
    --security-policy TLS_1_2 \
    --region ${REGION} 2>/dev/null || echo "API domain may already exist"

# Get API Gateway ID
API_ID=$(aws apigateway get-rest-apis \
    --query "items[?name=='PodcastFlow-Pro-API'].id" \
    --output text --region ${REGION})

if [ -n "$API_ID" ]; then
    # Create base path mapping
    aws apigateway create-base-path-mapping \
        --domain-name ${API_DOMAIN} \
        --rest-api-id ${API_ID} \
        --stage prod \
        --region ${REGION} 2>/dev/null || echo "Mapping may already exist"
    
    # Get the regional domain name for API Gateway
    API_REGIONAL_DOMAIN=$(aws apigateway get-domain-name \
        --domain-name ${API_DOMAIN} \
        --query "regionalDomainName" \
        --output text)
    
    API_HOSTED_ZONE=$(aws apigateway get-domain-name \
        --domain-name ${API_DOMAIN} \
        --query "regionalHostedZoneId" \
        --output text)
    
    # Create Route 53 record for API
    cat > /tmp/api-dns-record.json << EOF
{
    "Changes": [{
        "Action": "UPSERT",
        "ResourceRecordSet": {
            "Name": "${API_DOMAIN}",
            "Type": "A",
            "AliasTarget": {
                "HostedZoneId": "${API_HOSTED_ZONE}",
                "DNSName": "${API_REGIONAL_DOMAIN}",
                "EvaluateTargetHealth": false
            }
        }
    }]
}
EOF
    
    aws route53 change-resource-record-sets \
        --hosted-zone-id ${HOSTED_ZONE_ID} \
        --change-batch file:///tmp/api-dns-record.json
fi

# Step 5: Update environment configuration
echo -e "\n${GREEN}Step 5: Creating production configuration...${NC}"

cat > ../../.env.production << EOF
# Production Environment Configuration
NEXT_PUBLIC_API_ENDPOINT=https://${API_DOMAIN}
NEXT_PUBLIC_APP_URL=https://${FULL_DOMAIN}
NEXT_PUBLIC_ENVIRONMENT=production

# AWS Configuration
NEXT_PUBLIC_AWS_REGION=${REGION}
NEXT_PUBLIC_USER_POOL_ID=$(grep NEXT_PUBLIC_USER_POOL_ID ../../.env.local | cut -d '=' -f2)
NEXT_PUBLIC_USER_POOL_CLIENT_ID=$(grep NEXT_PUBLIC_USER_POOL_CLIENT_ID ../../.env.local | cut -d '=' -f2)

# Features
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_ERROR_TRACKING=true
NODE_ENV=production
EOF

# Step 6: Create production build script
cat > ../../scripts/deploy-production.sh << 'EOF'
#!/bin/bash
# Deploy to production

echo "Building for production..."
npm run build

echo "Starting production server..."
pm2 stop podcastflow-prod 2>/dev/null || true
pm2 start npm --name podcastflow-prod -- run start

echo "Production deployment complete!"
echo "Application running at: https://app.podcastflow.pro"
EOF

chmod +x ../../scripts/deploy-production.sh

# Step 7: Update EC2 security group
echo -e "\n${GREEN}Step 6: Updating EC2 security group...${NC}"
EC2_SG_ID=$(aws ec2 describe-instances \
    --instance-ids ${INSTANCE_ID} \
    --query "Reservations[0].Instances[0].SecurityGroups[0].GroupId" \
    --output text)

# Allow traffic from ALB only
aws ec2 authorize-security-group-ingress \
    --group-id ${EC2_SG_ID} \
    --protocol tcp --port 3001 \
    --source-group ${ALB_SG_ID} 2>/dev/null || echo "Rule may already exist"

echo -e "\n${GREEN}Production setup complete!${NC}"
echo ""
echo "✅ SSL Certificate: ${CERT_ARN}"
echo "✅ Application URL: https://${FULL_DOMAIN}"
echo "✅ API URL: https://${API_DOMAIN}"
echo "✅ Load Balancer: ${ALB_DNS}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Validate the SSL certificate in AWS Certificate Manager"
echo "2. Wait 5-10 minutes for DNS propagation"
echo "3. Run: ./setup-secrets.sh production"
echo "4. Deploy with: npm run build && pm2 start npm --name podcastflow -- run start"
echo ""
echo -e "${RED}IMPORTANT:${NC}"
echo "- Certificate validation is required before HTTPS will work"
echo "- Check certificate status: aws acm describe-certificate --certificate-arn ${CERT_ARN}"