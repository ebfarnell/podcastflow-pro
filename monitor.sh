#!/bin/bash

# Production monitoring script

echo "=== PodcastFlow Pro Production Status ==="
echo ""

# Check PM2 status
echo "PM2 Process Status:"
pm2 list

echo ""
echo "Application Health:"
curl -s -o /dev/null -w "- HTTP Status: %{http_code}\n- Response Time: %{time_total}s\n" https://app.podcastflow.pro/health

echo ""
echo "Memory Usage:"
pm2 info podcastflow-pro | grep -E "memory|heap"

echo ""
echo "Recent Logs (last 5 lines):"
pm2 logs podcastflow-pro --lines 5 --nostream

echo ""
echo "System Resources:"
free -h | grep -E "Mem|Swap"
df -h | grep -E "/$|Filesystem"

echo ""
echo "Nginx Status:"
sudo systemctl status nginx --no-pager | grep -E "Active|Main PID"

echo ""
echo "ALB Target Health:"
aws elbv2 describe-target-health \
  --target-group-arn "arn:aws:elasticloadbalancing:us-east-1:590183844530:targetgroup/podcastflow-tg/5dbeab252ca34f1c" \
  --query "TargetHealthDescriptions[*].[Target.Port,TargetHealth.State]" \
  --output table