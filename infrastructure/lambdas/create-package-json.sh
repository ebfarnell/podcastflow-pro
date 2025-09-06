#!/bin/bash

# Create package.json for all Lambda functions that don't have one

PACKAGE_JSON_CONTENT='{
  "name": "lambda-function",
  "version": "1.0.0",
  "description": "Lambda function",
  "main": "index.js",
  "dependencies": {
    "aws-sdk": "^2.1547.0"
  }
}'

# List of directories that need package.json
DIRECTORIES=(
  "insertion-orders"
  "agencies"
  "advertisers"
  "shows"
  "episodes"
  "availability"
  "ad-approvals"
  "ad-copy"
  "contracts"
  "reports"
  "financials"
)

# Create package.json in each directory
for dir in "${DIRECTORIES[@]}"; do
  if [ -d "$dir" ] && [ ! -f "$dir/package.json" ]; then
    echo "Creating package.json in $dir"
    echo "$PACKAGE_JSON_CONTENT" > "$dir/package.json"
  fi
done

echo "Package.json files created for all Lambda functions!"