#!/bin/bash

# Script to audit Lambda function invocations
REGION="us-east-1"
DAYS_AGO=30
START_TIME=$(date -d "$DAYS_AGO days ago" +%s)000

echo "Function Name,Last Modified,Last Invocation,Invocation Count (30d),Status"

# Get all Lambda functions
aws lambda list-functions --region $REGION --query "Functions[*].[FunctionName,LastModified]" --output text | while read -r function_name last_modified; do
    # Get invocation count from CloudWatch metrics
    invocation_count=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/Lambda \
        --metric-name Invocations \
        --dimensions Name=FunctionName,Value=$function_name \
        --start-time $(date -u -d "$DAYS_AGO days ago" +%Y-%m-%dT%H:%M:%S) \
        --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
        --period 2592000 \
        --statistics Sum \
        --region $REGION \
        --query "Datapoints[0].Sum" \
        --output text 2>/dev/null)
    
    # Check if function has been invoked
    if [ "$invocation_count" == "None" ] || [ -z "$invocation_count" ]; then
        invocation_count="0"
        last_invocation="Never"
        status="UNUSED"
    else
        # Try to get last invocation time from logs
        log_group="/aws/lambda/$function_name"
        last_log=$(aws logs describe-log-streams --log-group-name $log_group --order-by LastEventTime --descending --limit 1 --region $REGION --query "logStreams[0].lastEventTime" --output text 2>/dev/null)
        
        if [ "$last_log" != "None" ] && [ ! -z "$last_log" ]; then
            last_invocation=$(date -d @$((last_log/1000)) +%Y-%m-%d)
        else
            last_invocation="Unknown"
        fi
        
        if [ "$invocation_count" == "0" ]; then
            status="UNUSED"
        else
            status="ACTIVE"
        fi
    fi
    
    echo "$function_name,$last_modified,$last_invocation,$invocation_count,$status"
done | sort -t, -k5,5 -k4,4n