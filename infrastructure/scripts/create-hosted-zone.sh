#!/bin/bash

# Create Route 53 hosted zone for podcastflow.pro

set -e

DOMAIN="podcastflow.pro"
REGION="us-east-1"

echo "Creating Route 53 hosted zone for ${DOMAIN}..."

# Create hosted zone
HOSTED_ZONE=$(aws route53 create-hosted-zone \
    --name ${DOMAIN} \
    --caller-reference $(date +%s) \
    --hosted-zone-config Comment="PodcastFlow Pro Domain" \
    --query "HostedZone.Id" \
    --output text)

HOSTED_ZONE_ID=$(echo ${HOSTED_ZONE} | cut -d'/' -f3)

echo "Hosted Zone created: ${HOSTED_ZONE_ID}"

# Get name servers
NAME_SERVERS=$(aws route53 get-hosted-zone \
    --id ${HOSTED_ZONE_ID} \
    --query "DelegationSet.NameServers" \
    --output text)

echo ""
echo "========================================"
echo "Route 53 Hosted Zone Created!"
echo "========================================"
echo ""
echo "Domain: ${DOMAIN}"
echo "Hosted Zone ID: ${HOSTED_ZONE_ID}"
echo ""
echo "Name Servers (update your domain registrar):"
echo "----------------------------------------"
for ns in ${NAME_SERVERS}; do
    echo "  - ${ns}"
done
echo ""
echo "IMPORTANT NEXT STEPS:"
echo "1. Log into your domain registrar (where you bought podcastflow.pro)"
echo "2. Update the nameservers to the ones listed above"
echo "3. Wait 15-60 minutes for DNS propagation"
echo "4. Then run ./setup-production-simple.sh again"