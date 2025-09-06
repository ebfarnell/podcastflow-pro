#!/bin/bash

# Quick status checker for PodcastFlow Pro deployment

echo "======================================"
echo "PodcastFlow Pro - Deployment Status"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check certificate status
echo "🔐 SSL Certificate Status:"
CERT_STATUS=$(aws acm describe-certificate \
    --certificate-arn arn:aws:acm:us-east-1:590183844530:certificate/6ab69690-10b8-4706-8b1a-c0cf75277926 \
    --query "Certificate.Status" \
    --output text 2>/dev/null)

if [ "$CERT_STATUS" = "ISSUED" ]; then
    echo -e "   ${GREEN}✓ Certificate is validated and ready${NC}"
else
    echo -e "   ${YELLOW}⏳ Certificate status: $CERT_STATUS${NC}"
    echo "   Waiting for DNS validation..."
fi

echo ""
echo "🌐 DNS Status:"
# Check if nameservers are set
NS_CHECK=$(dig +short NS podcastflow.pro | grep -c "awsdns")
if [ $NS_CHECK -gt 0 ]; then
    echo -e "   ${GREEN}✓ Nameservers pointing to AWS${NC}"
    dig +short NS podcastflow.pro | sed 's/^/   - /'
else
    echo -e "   ${RED}✗ Nameservers not yet pointing to AWS${NC}"
    echo "   Update nameservers in Namecheap"
fi

# Check if domain resolves
echo ""
echo "📍 Domain Resolution:"
APP_IP=$(dig +short app.podcastflow.pro)
if [ -n "$APP_IP" ]; then
    echo -e "   ${GREEN}✓ app.podcastflow.pro resolves to: $APP_IP${NC}"
else
    echo -e "   ${YELLOW}⏳ app.podcastflow.pro not resolving yet${NC}"
fi

API_IP=$(dig +short api.podcastflow.pro)
if [ -n "$API_IP" ]; then
    echo -e "   ${GREEN}✓ api.podcastflow.pro resolves to: $API_IP${NC}"
else
    echo -e "   ${YELLOW}⏳ api.podcastflow.pro not resolving yet${NC}"
fi

# Check application status
echo ""
echo "🚀 Application Status:"
PM2_STATUS=$(pm2 list | grep -c "podcastflow-pro.*online" || echo 0)
if [ $PM2_STATUS -gt 0 ]; then
    echo -e "   ${GREEN}✓ Application is running${NC}"
else
    echo -e "   ${YELLOW}⚠ Application not running (run deploy-production.sh)${NC}"
fi

# Check load balancer
echo ""
echo "⚖️ Load Balancer Status:"
ALB_STATUS=$(aws elbv2 describe-load-balancers \
    --names podcastflow-alb \
    --query "LoadBalancers[0].State.Code" \
    --output text 2>/dev/null)
    
if [ "$ALB_STATUS" = "active" ]; then
    echo -e "   ${GREEN}✓ Load balancer is active${NC}"
    ALB_DNS=$(aws elbv2 describe-load-balancers \
        --names podcastflow-alb \
        --query "LoadBalancers[0].DNSName" \
        --output text)
    echo "   DNS: $ALB_DNS"
else
    echo -e "   ${RED}✗ Load balancer issue${NC}"
fi

# Summary
echo ""
echo "======================================"
echo "📋 Next Steps:"
echo "======================================"

if [ "$CERT_STATUS" != "ISSUED" ]; then
    echo "1. ⏳ Wait for certificate validation (5-30 minutes)"
fi

if [ $NS_CHECK -eq 0 ]; then
    echo "2. 🔧 Update nameservers in Namecheap to AWS nameservers"
fi

if [ -z "$APP_IP" ]; then
    echo "3. ⏳ Wait for DNS propagation (15-60 minutes after nameserver update)"
fi

if [ $PM2_STATUS -eq 0 ] && [ "$CERT_STATUS" = "ISSUED" ]; then
    echo "4. 🚀 Run: ./scripts/deploy-production.sh"
fi

echo ""
echo "Run this script again in a few minutes to check progress!"