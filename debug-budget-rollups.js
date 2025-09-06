const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: 'postgresql://podcastflow:PodcastFlow2025Prod@localhost:5432/podcastflow_production'
});

async function debugBudgetRollups() {
  const client = await pool.connect();
  
  try {
    // Set the schema
    await client.query('SET search_path TO org_podcastflow_pro, public');
    
    console.log('=== DEBUGGING ANNUAL BUDGET ROLLUPS ===\n');
    console.log('Year: 2025\n');
    
    // 1. Get all advertiser budgets with their assignments
    console.log('1. ADVERTISER BUDGETS:\n');
    const advertiserBudgets = await client.query(`
      SELECT 
        hb.id,
        hb."entityName" as name,
        hb."entityId",
        hb."budgetAmount",
        hb.month,
        hb."sellerId",
        hb."agencyId",
        s.name as seller_name,
        a.name as agency_name
      FROM "HierarchicalBudget" hb
      LEFT JOIN public."User" s ON hb."sellerId" = s.id
      LEFT JOIN "Agency" a ON hb."agencyId" = a.id
      WHERE hb.year = 2025 
        AND hb."entityType" = 'advertiser'
        AND hb."isActive" = true
      ORDER BY hb."entityName", hb.month
    `);
    
    let advertiserTotal = 0;
    let advertisersByEntity = {};
    
    for (const row of advertiserBudgets.rows) {
      if (!advertisersByEntity[row.entityId]) {
        advertisersByEntity[row.entityId] = {
          name: row.name,
          sellerId: row.sellerId,
          sellerName: row.seller_name,
          agencyId: row.agencyId,
          agencyName: row.agency_name,
          monthlyBudgets: {},
          total: 0
        };
      }
      
      advertisersByEntity[row.entityId].monthlyBudgets[row.month] = row.budgetAmount;
      advertisersByEntity[row.entityId].total += row.budgetAmount;
      advertiserTotal += row.budgetAmount;
    }
    
    // Print advertiser summary
    for (const [entityId, data] of Object.entries(advertisersByEntity)) {
      console.log(`Advertiser: ${data.name}`);
      console.log(`  - Entity ID: ${entityId}`);
      console.log(`  - Seller: ${data.sellerName || 'None'} (${data.sellerId || 'N/A'})`);
      console.log(`  - Agency: ${data.agencyName || 'None'} (${data.agencyId || 'N/A'})`);
      console.log(`  - Annual Total: $${data.total.toLocaleString()}`);
      console.log(`  - Included in rollups: Agency → Seller → Organization`);
      console.log('');
    }
    
    console.log(`Total Advertiser Budgets: $${advertiserTotal.toLocaleString()}\n`);
    
    // 2. Get all developmental seller goals
    console.log('2. DEVELOPMENTAL SELLER GOALS:\n');
    const devGoals = await client.query(`
      SELECT 
        hb.id,
        hb."entityName" as name,
        hb."entityId",
        hb."budgetAmount",
        hb.month,
        hb."sellerId",
        s.name as seller_name
      FROM "HierarchicalBudget" hb
      LEFT JOIN public."User" s ON hb."sellerId" = s.id
      WHERE hb.year = 2025 
        AND hb."entityType" = 'seller'
        AND hb."isActive" = true
      ORDER BY hb."entityName", hb.month
    `);
    
    let devGoalTotal = 0;
    let devGoalsByEntity = {};
    
    for (const row of devGoals.rows) {
      if (!devGoalsByEntity[row.entityId]) {
        devGoalsByEntity[row.entityId] = {
          name: row.name,
          sellerId: row.sellerId,
          sellerName: row.seller_name,
          monthlyBudgets: {},
          total: 0
        };
      }
      
      devGoalsByEntity[row.entityId].monthlyBudgets[row.month] = row.budgetAmount;
      devGoalsByEntity[row.entityId].total += row.budgetAmount;
      devGoalTotal += row.budgetAmount;
    }
    
    // Print developmental goals summary
    for (const [entityId, data] of Object.entries(devGoalsByEntity)) {
      console.log(`Developmental Goal: ${data.name}`);
      console.log(`  - Entity ID: ${entityId}`);
      console.log(`  - Seller: ${data.sellerName} (${data.sellerId})`);
      console.log(`  - Annual Total: $${data.total.toLocaleString()}`);
      console.log(`  - Included in rollups: Seller → Organization`);
      console.log('');
    }
    
    console.log(`Total Developmental Goals: $${devGoalTotal.toLocaleString()}\n`);
    
    // 3. Get all agency budgets (should be none if using advertiser rollups)
    console.log('3. AGENCY BUDGETS (checking for double-counting):\n');
    const agencyBudgets = await client.query(`
      SELECT 
        hb.id,
        hb."entityName" as name,
        hb."entityId",
        hb."budgetAmount",
        hb.month
      FROM "HierarchicalBudget" hb
      WHERE hb.year = 2025 
        AND hb."entityType" = 'agency'
        AND hb."isActive" = true
      ORDER BY hb."entityName", hb.month
    `);
    
    if (agencyBudgets.rows.length > 0) {
      console.log('WARNING: Found agency-level budgets that might cause double-counting!');
      for (const row of agencyBudgets.rows) {
        console.log(`  - ${row.name}: $${row.budgetAmount} (Month ${row.month})`);
      }
    } else {
      console.log('No agency-level budgets found (correct - prevents double-counting)');
    }
    console.log('');
    
    // 4. Calculate expected total
    console.log('4. TOTAL CALCULATION:\n');
    const expectedTotal = advertiserTotal + devGoalTotal;
    console.log(`Advertiser Budgets: $${advertiserTotal.toLocaleString()}`);
    console.log(`Developmental Goals: $${devGoalTotal.toLocaleString()}`);
    console.log(`Expected Total: $${expectedTotal.toLocaleString()}`);
    
    // 5. Check actual total from the API/UI perspective
    console.log('\n5. CHECKING ACTUAL ROLLUP CALCULATION:\n');
    
    // Get unique sellers with budgets
    const sellersWithBudgets = await client.query(`
      SELECT DISTINCT "sellerId", s.name as seller_name
      FROM "HierarchicalBudget" hb
      LEFT JOIN public."User" s ON hb."sellerId" = s.id
      WHERE hb.year = 2025 
        AND hb."isActive" = true
        AND hb."sellerId" IS NOT NULL
    `);
    
    let calculatedTotal = 0;
    
    for (const seller of sellersWithBudgets.rows) {
      // Get all budgets for this seller
      const sellerBudgets = await client.query(`
        SELECT 
          "entityType",
          "entityName",
          SUM("budgetAmount") as total
        FROM "HierarchicalBudget"
        WHERE year = 2025 
          AND "isActive" = true
          AND "sellerId" = $1
        GROUP BY "entityType", "entityName"
        ORDER BY "entityType", "entityName"
      `, [seller.sellerId]);
      
      let sellerTotal = 0;
      console.log(`\nSeller: ${seller.seller_name} (${seller.sellerId})`);
      
      for (const budget of sellerBudgets.rows) {
        console.log(`  - ${budget.entityType}: ${budget.entityName} = $${Number(budget.total).toLocaleString()}`);
        sellerTotal += Number(budget.total);
      }
      
      console.log(`  Seller Total: $${sellerTotal.toLocaleString()}`);
      calculatedTotal += sellerTotal;
    }
    
    console.log(`\nCalculated Organization Total: $${calculatedTotal.toLocaleString()}`);
    
    // 6. Identify discrepancies
    console.log('\n6. DISCREPANCY ANALYSIS:\n');
    if (calculatedTotal === expectedTotal) {
      console.log('✓ No discrepancy found - totals match!');
    } else {
      const diff = calculatedTotal - expectedTotal;
      console.log(`✗ Discrepancy found: $${Math.abs(diff).toLocaleString()} ${diff > 0 ? 'over' : 'under'}`);
      console.log(`  Expected: $${expectedTotal.toLocaleString()}`);
      console.log(`  Calculated: $${calculatedTotal.toLocaleString()}`);
    }
    
    // Check for budgets without seller assignment
    const orphanBudgets = await client.query(`
      SELECT 
        "entityType",
        "entityName",
        SUM("budgetAmount") as total
      FROM "HierarchicalBudget"
      WHERE year = 2025 
        AND "isActive" = true
        AND "sellerId" IS NULL
      GROUP BY "entityType", "entityName"
    `);
    
    if (orphanBudgets.rows.length > 0) {
      console.log('\nWARNING: Found budgets without seller assignment:');
      for (const orphan of orphanBudgets.rows) {
        console.log(`  - ${orphan.entityType}: ${orphan.entityName} = $${Number(orphan.total).toLocaleString()}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.release();
    pool.end();
  }
}

debugBudgetRollups();