const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: 'postgresql://podcastflow:PodcastFlow2025Prod@localhost:5432/podcastflow_production'
});

async function checkMonthlyFilter() {
  const client = await pool.connect();
  
  try {
    // Set the schema
    await client.query('SET search_path TO org_podcastflow_pro, public');
    
    console.log('=== CHECKING MONTHLY BUDGET TOTALS ===\n');
    
    // Get total by month
    const monthlyTotals = await client.query(`
      SELECT 
        month,
        SUM("budgetAmount") as total,
        COUNT(*) as count
      FROM "HierarchicalBudget"
      WHERE year = 2025 
        AND "isActive" = true
      GROUP BY month
      ORDER BY month
    `);
    
    console.log('Monthly Budget Totals:');
    let runningTotal = 0;
    for (const row of monthlyTotals.rows) {
      runningTotal += Number(row.total);
      console.log(`Month ${row.month}: $${Number(row.total).toLocaleString()} (${row.count} entries) - Running Total: $${runningTotal.toLocaleString()}`);
    }
    
    // Check specific month that might show $299k
    console.log('\n=== CHECKING IF ANY SINGLE MONTH HAS ~$299K ===\n');
    
    // Check month 7 (July)
    const julyTotal = await client.query(`
      SELECT 
        "entityType",
        COUNT(*) as count,
        SUM("budgetAmount") as total
      FROM "HierarchicalBudget"
      WHERE year = 2025 
        AND month = 7
        AND "isActive" = true
      GROUP BY "entityType"
      ORDER BY "entityType"
    `);
    
    console.log('July (Month 7) Breakdown:');
    let julyGrandTotal = 0;
    for (const row of julyTotal.rows) {
      julyGrandTotal += Number(row.total);
      console.log(`${row.entityType}: $${Number(row.total).toLocaleString()} (${row.count} entries)`);
    }
    console.log(`July Total: $${julyGrandTotal.toLocaleString()}`);
    
    // Check if there are any inactive budgets that might affect the total
    console.log('\n=== CHECKING INACTIVE BUDGETS ===\n');
    const inactiveBudgets = await client.query(`
      SELECT 
        "entityType",
        "entityName",
        SUM("budgetAmount") as total
      FROM "HierarchicalBudget"
      WHERE year = 2025 
        AND "isActive" = false
      GROUP BY "entityType", "entityName"
    `);
    
    if (inactiveBudgets.rows.length > 0) {
      console.log('Found inactive budgets:');
      for (const row of inactiveBudgets.rows) {
        console.log(`${row.entityType}: ${row.entityName} = $${Number(row.total).toLocaleString()}`);
      }
    } else {
      console.log('No inactive budgets found.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.release();
    pool.end();
  }
}

checkMonthlyFilter();