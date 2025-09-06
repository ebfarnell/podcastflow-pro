const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: 'postgresql://podcastflow:PodcastFlow2025Prod@localhost:5432/podcastflow_production'
});

async function debugDataTypes() {
  const client = await pool.connect();
  
  try {
    // Set the schema
    await client.query('SET search_path TO org_podcastflow_pro, public');
    
    console.log('=== DEBUGGING DATA TYPE ISSUES ===\n');
    
    // Get the raw data with explicit type casting
    const rawData = await client.query(`
      SELECT 
        month,
        "entityType",
        "entityName",
        "budgetAmount"::text as budget_text,
        "budgetAmount"::numeric as budget_numeric,
        "budgetAmount" as budget_raw,
        "actualAmount"::text as actual_text,
        "actualAmount"::numeric as actual_numeric,
        "actualAmount" as actual_raw
      FROM "HierarchicalBudget"
      WHERE year = 2025 AND "isActive" = true
      ORDER BY month, "entityType", "entityName"
      LIMIT 10
    `);
    
    console.log('Sample data with different type conversions:');
    for (const row of rawData.rows) {
      console.log(`\n${row.entityType}: ${row.entityName} (Month ${row.month})`);
      console.log(`  Budget - Text: ${row.budget_text}, Numeric: ${row.budget_numeric}, Raw: ${row.budget_raw}`);
      console.log(`  Actual - Text: ${row.actual_text}, Numeric: ${row.actual_numeric}, Raw: ${row.actual_raw}`);
    }
    
    // Now run the exact query from the API
    console.log('\n=== RUNNING EXACT API QUERY ===\n');
    
    const apiQuery = `
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
        WHERE hb.year = $1 AND hb."isActive" = true
        GROUP BY hb.year, hb.month
      )
      SELECT 
        period,
        "currentBudget"::numeric as "currentBudget",
        "currentActual"::numeric as "currentActual",
        "budgetVariance"::numeric as "budgetVariance"
      FROM current_data
      ORDER BY period
    `;
    
    const apiResult = await client.query(apiQuery, [2025]);
    
    console.log('API Query Results:');
    let totalBudget = 0;
    let totalActual = 0;
    
    for (const row of apiResult.rows) {
      const budget = parseFloat(row.currentBudget);
      const actual = parseFloat(row.currentActual);
      console.log(`${row.period}: Budget=${budget.toLocaleString()}, Actual=${actual.toLocaleString()}`);
      totalBudget += budget;
      totalActual += actual;
    }
    
    console.log(`\nTotal Budget: ${totalBudget.toLocaleString()}`);
    console.log(`Total Actual: ${totalActual.toLocaleString()}`);
    
    // Check if the issue is with the reduce function in JS
    console.log('\n=== TESTING JS REDUCE LOGIC ===\n');
    
    const testData = apiResult.rows.map(row => ({
      currentBudget: row.currentBudget,
      currentActual: row.currentActual
    }));
    
    console.log('Test data:', JSON.stringify(testData, null, 2));
    
    const reducedBudget = testData.reduce((sum, row) => sum + (row.currentBudget || 0), 0);
    const reducedActual = testData.reduce((sum, row) => sum + (row.currentActual || 0), 0);
    
    console.log(`\nReduced Budget: ${reducedBudget}`);
    console.log(`Reduced Actual: ${reducedActual}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.release();
    pool.end();
  }
}

debugDataTypes();