#!/bin/bash

# Copy static files to standalone directory
echo "Copying static files to standalone directory..."

# Copy .next/static directory
if [ -d ".next/static" ]; then
    cp -r .next/static .next/standalone/.next/
    echo "✓ Static files copied"
else
    echo "✗ No .next/static directory found"
fi

# Copy public directory
if [ -d "public" ]; then
    cp -r public .next/standalone/
    echo "✓ Public directory copied"
else
    echo "✗ No public directory found"
fi

echo "Done!"