const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: 'postgresql://podcastflow:PodcastFlow2025Prod@localhost:5432/podcastflow_production'
});

async function debugActualAmounts() {
  const client = await pool.connect();
  
  try {
    // Set the schema
    await client.query('SET search_path TO org_podcastflow_pro, public');
    
    console.log('=== DEBUGGING ACTUAL AMOUNT DISCREPANCY ===\n');
    
    // Check all actual amounts for January
    const januaryActuals = await client.query(`
      SELECT 
        "entityType",
        "entityName",
        "budgetAmount",
        "actualAmount"
      FROM "HierarchicalBudget"
      WHERE year = 2025 
        AND month = 1
        AND "isActive" = true
      ORDER BY "entityType", "entityName"
    `);
    
    console.log('January Budget Entries:');
    let totalBudget = 0;
    let totalActual = 0;
    
    for (const row of januaryActuals.rows) {
      console.log(`${row.entityType}: ${row.entityName}`);
      console.log(`  Budget: $${Number(row.budgetAmount).toLocaleString()}`);
      console.log(`  Actual: $${Number(row.actualAmount).toLocaleString()}`);
      totalBudget += Number(row.budgetAmount);
      totalActual += Number(row.actualAmount);
    }
    
    console.log(`\nJanuary Totals:`);
    console.log(`  Total Budget: $${totalBudget.toLocaleString()}`);
    console.log(`  Total Actual: $${totalActual.toLocaleString()}`);
    
    // Check if there are any records that would make actual = 172,200
    console.log('\n=== CHECKING FOR $172,200 ACTUAL ===\n');
    
    // Check if there's an additional $10,000 somewhere
    const difference = 172200 - 162200;
    console.log(`Looking for missing $${difference.toLocaleString()}...`);
    
    // Check all budget entries across all months
    const allEntries = await client.query(`
      SELECT 
        month,
        "entityType",
        "entityName",
        "budgetAmount",
        "actualAmount",
        "isActive"
      FROM "HierarchicalBudget"
      WHERE year = 2025
        AND "actualAmount" = 10000
      ORDER BY month, "entityType", "entityName"
    `);
    
    if (allEntries.rows.length > 0) {
      console.log('Found entries with $10,000 actual:');
      for (const row of allEntries.rows) {
        console.log(`Month ${row.month} - ${row.entityType}: ${row.entityName} (Active: ${row.isActive})`);
      }
    } else {
      console.log('No entries found with exactly $10,000 actual.');
    }
    
    // Check the total budget that shows in API (215k for January)
    console.log('\n=== CHECKING FOR $215,000 BUDGET ===\n');
    
    // $327k - $215k = $112k difference
    const budgetDiff = 327000 - 215000;
    console.log(`Missing $${budgetDiff.toLocaleString()} from budget...`);
    
    // Check if developmental goal is being excluded
    const sellerBudgets = await client.query(`
      SELECT 
        month,
        "entityName",
        "budgetAmount",
        "actualAmount",
        "sellerId"
      FROM "HierarchicalBudget"
      WHERE year = 2025
        AND "entityType" = 'seller'
        AND "isActive" = true
    `);
    
    console.log('\nSeller/Developmental Budgets:');
    for (const row of sellerBudgets.rows) {
      console.log(`Month ${row.month}: ${row.entityName}`);
      console.log(`  Budget: $${Number(row.budgetAmount).toLocaleString()}`);
      console.log(`  Seller ID: ${row.sellerId}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.release();
    pool.end();
  }
}

debugActualAmounts();