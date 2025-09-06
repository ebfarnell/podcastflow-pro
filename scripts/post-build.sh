#!/bin/bash
# Post-build script to copy static files to nginx directory

echo "Copying static files to nginx directory..."
sudo rm -rf /var/www/podcastflow-static/*
sudo cp -r /home/ec2-user/podcastflow-pro/.next/static/* /var/www/podcastflow-static/
sudo chown -R nginx:nginx /var/www/podcastflow-static/
echo "Static files copied to nginx directory!"

# Ensure prerender-manifest.json exists
echo "Ensuring prerender-manifest.json exists..."
/home/ec2-user/podcastflow-pro/scripts/ensure-prerender-manifest.sh

echo "Post-build tasks completed!"