const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: 'postgresql://podcastflow:PodcastFlow2025Prod@localhost:5432/podcastflow_production'
});

async function debugComparisonQuery() {
  const client = await pool.connect();
  
  try {
    // Set the schema
    await client.query('SET search_path TO org_podcastflow_pro, public');
    
    console.log('=== DEBUGGING BUDGET COMPARISON QUERY ===\n');
    
    // Simulate the comparison query from the API
    const comparisonQuery = `
      WITH current_data AS (
        SELECT 
          hb.year, hb.month as period_key,
          hb.year || '-' || LPAD(hb.month::text, 2, '0') as period,
          SUM(hb."budgetAmount") as "currentBudget",
          SUM(hb."actualAmount") as "currentActual",
          SUM(hb."actualAmount" - hb."budgetAmount") as "budgetVariance",
          COUNT(DISTINCT CASE 
            WHEN ABS(hb."actualAmount" - hb."budgetAmount") < (hb."budgetAmount" * 0.1) 
            THEN hb."sellerId" 
          END) as "sellersOnTarget",
          COUNT(DISTINCT CASE 
            WHEN ABS(hb."actualAmount" - hb."budgetAmount") >= (hb."budgetAmount" * 0.1) 
            THEN hb."sellerId" 
          END) as "sellersOffTarget"
        FROM "HierarchicalBudget" hb
        LEFT JOIN public."User" s ON hb."sellerId" = s.id
        WHERE hb.year = 2025 AND hb."isActive" = true
        GROUP BY hb.year, hb.month
      )
      SELECT * FROM current_data ORDER BY period
    `;
    
    const result = await client.query(comparisonQuery);
    
    console.log('Comparison Query Results:');
    let totalBudget = 0;
    let totalActual = 0;
    
    for (const row of result.rows) {
      console.log(`${row.period}: Budget=$${Number(row.currentBudget).toLocaleString()}, Actual=$${Number(row.currentActual).toLocaleString()}`);
      totalBudget += Number(row.currentBudget);
      totalActual += Number(row.currentActual);
    }
    
    console.log(`\nTotal from Comparison Query: $${totalBudget.toLocaleString()}`);
    
    // Now let's see what's different from the direct sum
    console.log('\n=== CHECKING WHAT\'S MISSING ===\n');
    
    // Get all budgets grouped by month
    const allBudgets = await client.query(`
      SELECT 
        month,
        "entityType",
        "entityName",
        "budgetAmount",
        "actualAmount"
      FROM "HierarchicalBudget"
      WHERE year = 2025 AND "isActive" = true
      ORDER BY month, "entityType", "entityName"
    `);
    
    const monthlyBreakdown = {};
    
    for (const row of allBudgets.rows) {
      if (!monthlyBreakdown[row.month]) {
        monthlyBreakdown[row.month] = {
          advertiser: { count: 0, budget: 0, actual: 0 },
          agency: { count: 0, budget: 0, actual: 0 },
          seller: { count: 0, budget: 0, actual: 0 }
        };
      }
      
      monthlyBreakdown[row.month][row.entityType].count++;
      monthlyBreakdown[row.month][row.entityType].budget += Number(row.budgetAmount);
      monthlyBreakdown[row.month][row.entityType].actual += Number(row.actualAmount);
    }
    
    console.log('Monthly Breakdown by Entity Type:');
    for (const [month, data] of Object.entries(monthlyBreakdown)) {
      console.log(`\nMonth ${month}:`);
      for (const [type, totals] of Object.entries(data)) {
        if (totals.count > 0) {
          console.log(`  ${type}: ${totals.count} entries, Budget=$${totals.budget.toLocaleString()}, Actual=$${totals.actual.toLocaleString()}`);
        }
      }
    }
    
    // Check if developmental goals are being excluded
    console.log('\n=== CHECKING SELLER (DEVELOPMENTAL) GOALS ===\n');
    
    const sellerGoals = await client.query(`
      SELECT 
        month,
        "entityName",
        "budgetAmount",
        "actualAmount"
      FROM "HierarchicalBudget"
      WHERE year = 2025 
        AND "entityType" = 'seller'
        AND "isActive" = true
      ORDER BY month, "entityName"
    `);
    
    console.log('Seller/Developmental Goals:');
    for (const row of sellerGoals.rows) {
      console.log(`Month ${row.month}: ${row.entityName} - Budget=$${Number(row.budgetAmount).toLocaleString()}, Actual=$${Number(row.actualAmount).toLocaleString()}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.release();
    pool.end();
  }
}

debugComparisonQuery();