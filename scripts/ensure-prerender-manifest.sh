#!/bin/bash

# Ensure prerender-manifest.json exists after build
MANIFEST_JS="/home/ec2-user/podcastflow-pro/.next/prerender-manifest.js"
MANIFEST_JSON="/home/ec2-user/podcastflow-pro/.next/prerender-manifest.json"

# Check if the JS file exists
if [ -f "$MANIFEST_JS" ]; then
    echo "Found prerender-manifest.js, extracting content..."
    
    # Extract the JSON content from the JS file
    # The JS file contains: self.__PRERENDER_MANIFEST="<json-content>"
    node -e "
    const fs = require('fs');
    const content = fs.readFileSync('$MANIFEST_JS', 'utf8');
    const match = content.match(/self\.__PRERENDER_MANIFEST=\"(.+)\"/);
    if (match) {
        const jsonContent = match[1].replace(/\\\\\"/g, '\"');
        const parsed = JSON.parse(jsonContent);
        // Ensure required properties exist
        if (!parsed.routes) parsed.routes = {};
        if (!parsed.dynamicRoutes) parsed.dynamicRoutes = {};
        if (!parsed.notFoundRoutes) parsed.notFoundRoutes = [];
        if (!parsed.version) parsed.version = 4;
        fs.writeFileSync('$MANIFEST_JSON', JSON.stringify(parsed));
        console.log('Successfully created prerender-manifest.json with required properties');
    } else {
        console.error('Could not extract JSON from prerender-manifest.js');
        // Create a default manifest
        const defaultManifest = {
            version: 4,
            routes: {},
            dynamicRoutes: {},
            notFoundRoutes: [],
            preview: {
                previewModeId: 'default-preview-id',
                previewModeSigningKey: 'default-signing-key',
                previewModeEncryptionKey: 'default-encryption-key'
            }
        };
        fs.writeFileSync('$MANIFEST_JSON', JSON.stringify(defaultManifest));
        console.log('Created default prerender-manifest.json');
    }
    "
else
    echo "prerender-manifest.js not found, creating default manifest..."
    # Create a default manifest if JS file doesn't exist
    cat > "$MANIFEST_JSON" << 'EOF'
{
  "version": 4,
  "routes": {},
  "dynamicRoutes": {},
  "notFoundRoutes": [],
  "preview": {
    "previewModeId": "default-preview-id",
    "previewModeSigningKey": "default-signing-key",
    "previewModeEncryptionKey": "default-encryption-key"
  }
}
EOF
    echo "Created default prerender-manifest.json"
fi

# Verify the file exists
if [ -f "$MANIFEST_JSON" ]; then
    echo "✓ prerender-manifest.json exists"
    ls -la "$MANIFEST_JSON"
else
    echo "✗ Failed to create prerender-manifest.json"
    exit 1
fi