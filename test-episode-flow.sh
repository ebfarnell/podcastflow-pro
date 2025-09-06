#!/bin/bash

echo "🧪 Testing Episode Data Flow"
echo ""

export PGPASSWORD=PodcastFlow2025Prod

# Test 1: Check that all ScheduleBuilderItems have episodes
echo "Test 1: Checking ScheduleBuilderItems have episodes..."
ITEMS_WITHOUT_EPISODES=$(psql -U podcastflow -h localhost -d podcastflow_production -t -c 'SELECT COUNT(*) FROM org_podcastflow_pro."ScheduleBuilderItem" WHERE "episodeId" IS NULL')
echo "  Items without episodes: $ITEMS_WITHOUT_EPISODES"
if [ "$ITEMS_WITHOUT_EPISODES" -eq "0" ]; then
  echo "  ✅ All ScheduleBuilderItems have episodes"
else
  echo "  ⚠️ Some items still missing episodes"
fi

# Test 2: Check that episodes have valid episode numbers
echo ""
echo "Test 2: Checking episodes have valid episode numbers..."
EPISODES_WITH_ZERO=$(psql -U podcastflow -h localhost -d podcastflow_production -t -c 'SELECT COUNT(*) FROM org_podcastflow_pro."Episode" WHERE "episodeNumber" = 0 OR "episodeNumber" IS NULL')
echo "  Episodes with invalid numbers: $EPISODES_WITH_ZERO"
if [ "$EPISODES_WITH_ZERO" -eq "0" ]; then
  echo "  ✅ All episodes have valid episode numbers"
else
  echo "  ⚠️ Some episodes have invalid episode numbers"
fi

# Test 3: Check that episodes have titles
echo ""
echo "Test 3: Checking episodes have titles..."
EPISODES_WITHOUT_TITLES=$(psql -U podcastflow -h localhost -d podcastflow_production -t -c "SELECT COUNT(*) FROM org_podcastflow_pro.\"Episode\" WHERE title IS NULL OR title = '' OR title = 'Unknown Episode'")
echo "  Episodes without proper titles: $EPISODES_WITHOUT_TITLES"
if [ "$EPISODES_WITHOUT_TITLES" -eq "0" ]; then
  echo "  ✅ All episodes have proper titles"
else
  echo "  ⚠️ Some episodes missing proper titles"
fi

# Test 4: Check EpisodeInventory exists for all episodes
echo ""
echo "Test 4: Checking EpisodeInventory records..."
EPISODES_WITHOUT_INVENTORY=$(psql -U podcastflow -h localhost -d podcastflow_production -t -c 'SELECT COUNT(*) FROM org_podcastflow_pro."Episode" e WHERE NOT EXISTS (SELECT 1 FROM org_podcastflow_pro."EpisodeInventory" ei WHERE ei."episodeId" = e.id) AND e.status = '"'"'scheduled'"'"'')
echo "  Episodes without inventory: $EPISODES_WITHOUT_INVENTORY"
if [ "$EPISODES_WITHOUT_INVENTORY" -eq "0" ]; then
  echo "  ✅ All scheduled episodes have inventory records"
else
  echo "  ⚠️ Some episodes missing inventory records"
fi

# Test 5: Sample data verification
echo ""
echo "Test 5: Sample episode data..."
echo "  Recent episodes:"
psql -U podcastflow -h localhost -d podcastflow_production -c 'SELECT e."episodeNumber", e.title, s.name as show_name, e."airDate" FROM org_podcastflow_pro."Episode" e JOIN org_podcastflow_pro."Show" s ON s.id = e."showId" ORDER BY e."createdAt" DESC LIMIT 3' | head -10

# Test 6: Check schedule builder items have proper linkage
echo ""
echo "Test 6: Checking schedule builder items linkage..."
PROPERLY_LINKED=$(psql -U podcastflow -h localhost -d podcastflow_production -t -c 'SELECT COUNT(*) FROM org_podcastflow_pro."ScheduleBuilderItem" sbi JOIN org_podcastflow_pro."Episode" e ON e.id = sbi."episodeId" WHERE e."showId" = sbi."showId" AND DATE(e."airDate") = sbi."airDate"')
TOTAL_ITEMS=$(psql -U podcastflow -h localhost -d podcastflow_production -t -c 'SELECT COUNT(*) FROM org_podcastflow_pro."ScheduleBuilderItem"')
echo "  Properly linked items: $PROPERLY_LINKED/$TOTAL_ITEMS"
if [ "$PROPERLY_LINKED" -eq "$TOTAL_ITEMS" ]; then
  echo "  ✅ All items properly linked to episodes"
else
  echo "  ⚠️ Some items have mismatched episode linkage"
fi

echo ""
echo "✨ Episode data flow tests complete!"