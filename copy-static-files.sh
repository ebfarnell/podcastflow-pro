#!/bin/bash

# Script to copy static files to nginx-accessible location
# This should be run after each build

echo "Copying static files to nginx-accessible location..."

# Copy static files from build directory
sudo cp -r /home/ec2-user/podcastflow-pro/.next/static/* /var/www/podcastflow-static/

# Set proper ownership
sudo chown -R nginx:nginx /var/www/podcastflow-static/

echo "Static files copied successfully!"