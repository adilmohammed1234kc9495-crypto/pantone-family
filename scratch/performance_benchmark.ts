import { query, getPool } from "./src/config/database.js";

interface BenchmarkResult {
  operation: string;
  iterations: number;
  totalTimeMs: number;
  avgTimeMs: number;
  minTimeMs: number;
  maxTimeMs: number;
  p95TimeMs: number;
}

async function runBenchmark(name: string, iterations: number, fn: () => Promise<void>): Promise<BenchmarkResult> {
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    await fn();
    const t1 = performance.now();
    times.push(t1 - t0);
  }

  times.sort((a, b) => a - b);
  const total = times.reduce((sum, t) => sum + t, 0);
  const avg = total / times.length;
  const min = times[0];
  const max = times[times.length - 1];
  const p95 = times[Math.floor(times.length * 0.95)];

  return {
    operation: name,
    iterations,
    totalTimeMs: Math.round(total * 100) / 100,
    avgTimeMs: Math.round(avg * 100) / 100,
    minTimeMs: Math.round(min * 100) / 100,
    maxTimeMs: Math.round(max * 100) / 100,
    p95TimeMs: Math.round(p95 * 100) / 100,
  };
}

async function main() {
  console.log("==================================================");
  console.log("PHASE 12: REALISTIC PERFORMANCE & STRESS BENCHMARK");
  console.log("==================================================");

  const results: BenchmarkResult[] = [];

  // 1. Dashboard KPI Aggregation Query
  results.push(await runBenchmark("Dashboard KPI Summary Query", 50, async () => {
    await query(`
      SELECT 
        COUNT(*) as total_assets,
        COUNT(*) FILTER (WHERE status = 'AVAILABLE') as available_assets,
        COUNT(*) FILTER (WHERE status = 'ASSIGNED') as assigned_assets,
        COUNT(*) FILTER (WHERE status = 'UNDER_MAINTENANCE') as maintenance_assets,
        COALESCE(SUM(current_value), 0) as total_book_value
      FROM assets
    `);
  }));

  // 2. Asset Register with Multi-Table Joins & Search
  results.push(await runBenchmark("Asset Search & Filter Query (with 5 Joins)", 50, async () => {
    await query(`
      SELECT 
        a.id, a.asset_tag, a.name, a.status, a.current_value,
        c.name as company_name,
        cat.name as category_name,
        d.name as department_name,
        l.building as location_building
      FROM assets a
      JOIN companies c ON c.id = a.company_id
      JOIN asset_categories cat ON cat.id = a.category_id
      LEFT JOIN departments d ON d.id = a.department_id
      LEFT JOIN locations l ON l.id = a.location_id
      WHERE a.status IN ('AVAILABLE', 'ASSIGNED')
      ORDER BY a.created_at DESC
      LIMIT 25 OFFSET 0
    `);
  }));

  // 3. Stock Ledger Movement Query with Pagination
  results.push(await runBenchmark("Stock Movements Ledger Pagination", 50, async () => {
    await query(`
      SELECT 
        sm.id, sm.movement_type, sm.quantity, sm.balance_before, sm.balance_after, sm.created_at,
        si.stock_code, si.item_name
      FROM stock_movements sm
      JOIN stock_items si ON si.id = sm.stock_item_id
      ORDER BY sm.created_at DESC
      LIMIT 20 OFFSET 0
    `);
  }));

  // 4. Audit Log Query with Category & Severity Filter
  results.push(await runBenchmark("Audit Log Filtering by Category & Severity", 50, async () => {
    await query(`
      SELECT 
        id, action, entity, severity, category, status, timestamp
      FROM audit_logs
      WHERE category = 'SECURITY' OR severity = 'CRITICAL'
      ORDER BY timestamp DESC
      LIMIT 50
    `);
  }));

  // 5. Depreciation Schedule Calculation Batch
  results.push(await runBenchmark("Depreciation Batch Schedule Query", 50, async () => {
    await query(`
      SELECT 
        id, asset_tag, purchase_cost, current_value, useful_life_months,
        depreciation_rate_percent, depreciation_start_date
      FROM assets
      WHERE depreciation_method = 'STRAIGHT_LINE'
      LIMIT 50
    `);
  }));

  console.log("\nBENCHMARK RESULTS SUMMARY:");
  console.table(results);

  // Verification checks
  const anySlow = results.filter(r => r.avgTimeMs > 500);
  if (anySlow.length > 0) {
    console.error("WARNING: Slow queries detected exceeding 500ms threshold!", anySlow);
  } else {
    console.log("ALL QUERIES PASSED: Average latency is well under the 500ms SLA.");
  }

  await getPool().end();
}

main().catch(err => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
