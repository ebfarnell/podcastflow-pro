#!/bin/bash

# Script to set default spot configuration for shows
echo "=== Fixing Spot Configuration for Shows ==="

export PGPASSWORD=PodcastFlow2025Prod

# Set default spot configuration for all shows
psql -U podcastflow -h localhost -d podcastflow_production << 'EOF'
SET search_path TO org_podcastflow_pro;

-- Update shows with default spot configuration
UPDATE "Show"
SET "spotConfiguration" = jsonb_build_object(
  'preRoll', jsonb_build_object(
    'enabled', true,
    'slots', 2,
    'duration', 30,
    'price', 50.00
  ),
  'midRoll', jsonb_build_object(
    'enabled', true,
    'slots', 3,
    'duration', 30,
    'price', 75.00
  ),
  'postRoll', jsonb_build_object(
    'enabled', true,
    'slots', 2,
    'duration', 30,
    'price', 40.00
  )
)
WHERE "spotConfiguration" = '{}' OR "spotConfiguration" IS NULL;

-- Show updated configuration
SELECT 
  id,
  name,
  jsonb_pretty("spotConfiguration") as spot_config
FROM "Show"
ORDER BY name;
EOF

echo ""
echo "✅ Spot configuration updated for all shows"