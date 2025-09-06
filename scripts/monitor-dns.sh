#!/bin/bash

# DNS Propagation Monitor

echo "Monitoring DNS propagation for podcastflow.pro..."
echo "This will check every 2 minutes until the nameservers update"
echo "Press Ctrl+C to stop"
echo ""

while true; do
    echo "=== Check at $(date) ==="
    
    # Check nameservers
    NS_CHECK=$(dig NS podcastflow.pro +short | grep -c "awsdns")
    if [ $NS_CHECK -gt 0 ]; then
        echo "✅ Nameservers updated to AWS!"
        dig NS podcastflow.pro +short
        
        # Check app subdomain
        APP_CHECK=$(dig app.podcastflow.pro +short | wc -l)
        if [ $APP_CHECK -gt 0 ]; then
            echo "✅ app.podcastflow.pro is resolving!"
            dig app.podcastflow.pro +short
            
            # Test HTTPS
            if curl -Is https://app.podcastflow.pro | head -1 | grep -q "200"; then
                echo "🎉 Site is accessible! https://app.podcastflow.pro"
                break
            else
                echo "⏳ Waiting for HTTPS to be accessible..."
            fi
        else
            echo "⏳ Waiting for app subdomain to resolve..."
        fi
    else
        echo "⏳ Still showing old nameservers. Waiting..."
        echo "Current: $(dig NS podcastflow.pro +short | head -1)"
    fi
    
    echo ""
    sleep 120  # Check every 2 minutes
done

echo ""
echo "🚀 Your site is now live at: https://app.podcastflow.pro"