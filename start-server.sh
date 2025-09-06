#!/bin/bash

# Ensure prerender-manifest.json exists before starting the server
echo "Pre-start: Ensuring prerender-manifest.json exists..."
/home/ec2-user/podcastflow-pro/scripts/ensure-prerender-manifest.sh

# Start the actual server
echo "Starting Next.js server..."
exec npm start