const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkData() {
  console.log('=== CHECKING DATABASE DATA ===\n');

  // 1. Check shows
  console.log('1. SHOWS:');
  const { data: shows, error: showsError } = await supabase
    .from('shows')
    .select('*')
    .order('created_at', { ascending: true });

  if (showsError) {
    console.error('Error fetching shows:', showsError);
  } else {
    console.log(`Total shows: ${shows.length}`);
    shows.forEach(show => {
      console.log(`
  - Show: ${show.title}
    ID: ${show.id}
    OrganizationID: ${show.organizationId}
    Status: ${show.status}
    Created: ${show.created_at}`);
    });
  }

  // 2. Check episodes
  console.log('\n2. EPISODES:');
  const { data: episodes, error: episodesError } = await supabase
    .from('episodes')
    .select('*')
    .order('created_at', { ascending: true });

  if (episodesError) {
    console.error('Error fetching episodes:', episodesError);
  } else {
    console.log(`Total episodes: ${episodes.length}`);
    episodes.forEach(episode => {
      console.log(`
  - Episode: ${episode.title}
    ID: ${episode.id}
    ShowID: ${episode.showId}
    Status: ${episode.status}
    CreatedBy: ${episode.createdBy}`);
    });
  }

  // 3. Check producer user
  console.log('\n3. PRODUCER USER:');
  const { data: producerUser, error: producerUserError } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'producer@podcastflow.com')
    .single();

  if (producerUserError) {
    console.error('Error fetching producer user:', producerUserError);
  } else {
    console.log(`
  - Producer User:
    ID: ${producerUser.id}
    Email: ${producerUser.email}
    OrganizationID: ${producerUser.organizationId}
    Role: ${producerUser.role}`);
  }

  // 4. Check analytics
  console.log('\n4. ANALYTICS DATA:');
  const { data: analytics, error: analyticsError } = await supabase
    .from('episode_analytics')
    .select('*')
    .limit(5);

  if (analyticsError) {
    console.error('Error fetching analytics:', analyticsError);
  } else {
    console.log(`Total analytics records (showing first 5): ${analytics.length}`);
    analytics.forEach(record => {
      console.log(`
  - Analytics:
    EpisodeID: ${record.episodeId}
    Date: ${record.date}
    Downloads: ${record.downloads}
    Listeners: ${record.uniqueListeners}`);
    });
  }

  // 5. Check if producer's org matches any shows
  if (producerUser && shows) {
    console.log('\n5. ORGANIZATION MATCH CHECK:');
    const producerShows = shows.filter(show => show.organizationId === producerUser.organizationId);
    console.log(`Producer has access to ${producerShows.length} shows`);
    if (producerShows.length === 0) {
      console.log('WARNING: Producer organizationId does not match any shows!');
      console.log(`Producer org: ${producerUser.organizationId}`);
      console.log(`Show orgs: ${[...new Set(shows.map(s => s.organizationId))].join(', ')}`);
    }
  }

  process.exit(0);
}

checkData().catch(console.error);