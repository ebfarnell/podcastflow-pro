#!/bin/bash

# Script to release orphaned reservations in EpisodeInventory
# This will clear reserved spots that have no associated campaigns

echo "=== Releasing Orphaned Reservations ==="
echo "This will clear all reserved spots in EpisodeInventory since no campaigns exist"
echo ""

# Set PostgreSQL password
export PGPASSWORD=PodcastFlow2025Prod

# First, show what will be released
echo "Checking for orphaned reservations..."
psql -U podcastflow -h localhost -d podcastflow_production << EOF
SET search_path TO org_podcastflow_pro;

-- Show summary
SELECT 
  COUNT(*) as episodes_affected,
  SUM("preRollReserved") as preroll_to_release,
  SUM("midRollReserved") as midroll_to_release,
  SUM("postRollReserved") as postroll_to_release,
  SUM("preRollReserved" + "midRollReserved" + "postRollReserved") as total_to_release
FROM "EpisodeInventory"
WHERE "preRollReserved" > 0 OR "midRollReserved" > 0 OR "postRollReserved" > 0;

-- Show some examples
SELECT 
  ei."episodeId",
  s.name as show_name,
  e.title as episode_title,
  ei."airDate",
  ei."preRollReserved" as pre,
  ei."midRollReserved" as mid,
  ei."postRollReserved" as post
FROM "EpisodeInventory" ei
JOIN "Episode" e ON e.id = ei."episodeId"
JOIN "Show" s ON s.id = ei."showId"
WHERE ei."preRollReserved" > 0 OR ei."midRollReserved" > 0 OR ei."postRollReserved" > 0
ORDER BY ei."airDate" DESC
LIMIT 5;
EOF

echo ""
read -p "Do you want to release these reservations? (yes/no): " confirm

if [ "$confirm" = "yes" ]; then
  echo ""
  echo "Releasing reservations..."
  
  psql -U podcastflow -h localhost -d podcastflow_production << EOF
SET search_path TO org_podcastflow_pro;

-- Release all reserved spots
UPDATE "EpisodeInventory"
SET 
  "preRollReserved" = 0,
  "midRollReserved" = 0,
  "postRollReserved" = 0,
  "preRollAvailable" = "preRollSlots",
  "midRollAvailable" = "midRollSlots",
  "postRollAvailable" = "postRollSlots",
  "holdExpiresAt" = NULL,
  "updatedAt" = NOW()
WHERE "preRollReserved" > 0 OR "midRollReserved" > 0 OR "postRollReserved" > 0;

-- Show result
SELECT 
  COUNT(*) as episodes_cleared,
  SUM("preRollReserved") as remaining_preroll,
  SUM("midRollReserved") as remaining_midroll,
  SUM("postRollReserved") as remaining_postroll
FROM "EpisodeInventory"
WHERE "preRollReserved" > 0 OR "midRollReserved" > 0 OR "postRollReserved" > 0;
EOF

  echo ""
  echo "✅ Reservations released successfully!"
else
  echo "Operation cancelled."
fi