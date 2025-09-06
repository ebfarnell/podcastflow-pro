#!/bin/bash

# Validate SSL certificate via DNS

set -e

CERT_ARN="arn:aws:acm:us-east-1:590183844530:certificate/6ab69690-10b8-4706-8b1a-c0cf75277926"
HOSTED_ZONE_ID="Z04345471WAC1KVXSQIGM"

echo "Getting certificate validation records..."

# Get validation options
VALIDATION_OPTIONS=$(aws acm describe-certificate \
    --certificate-arn ${CERT_ARN} \
    --query "Certificate.DomainValidationOptions" \
    --region us-east-1)

echo "Creating DNS validation records..."

# Create validation records
echo "${VALIDATION_OPTIONS}" | jq -r '.[] | select(.ValidationMethod=="DNS") | .ResourceRecord | @base64' | while read -r record; do
    RECORD=$(echo ${record} | base64 -d)
    
    NAME=$(echo ${RECORD} | jq -r '.Name')
    VALUE=$(echo ${RECORD} | jq -r '.Value')
    TYPE=$(echo ${RECORD} | jq -r '.Type')
    
    echo "Creating validation record: ${NAME}"
    
    cat > /tmp/validation-record.json << EOF
{
    "Changes": [{
        "Action": "UPSERT",
        "ResourceRecordSet": {
            "Name": "${NAME}",
            "Type": "${TYPE}",
            "TTL": 300,
            "ResourceRecords": [{"Value": "${VALUE}"}]
        }
    }]
}
EOF
    
    aws route53 change-resource-record-sets \
        --hosted-zone-id ${HOSTED_ZONE_ID} \
        --change-batch file:///tmp/validation-record.json
done

echo ""
echo "DNS validation records created!"
echo "Certificate validation will complete automatically in 5-10 minutes."
echo ""
echo "Check status with:"
echo "aws acm describe-certificate --certificate-arn ${CERT_ARN} --query 'Certificate.Status'"