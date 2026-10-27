const { Client } = require("../frontend/node_modules/pg");

async function compareDatabases() {
  const c1 = new Client({ connectionString: "postgresql://postgres:testpass@localhost:5433/belconnect_test" });
  const c2 = new Client({ connectionString: "postgresql://postgres:testpass@localhost:5433/belconnect_restore_test" });
  await c1.connect();
  await c2.connect();

  const tablesRes = await c1.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
  );
  const tables = tablesRes.rows.map((r) => r.tablename);

  console.log("================================================================================");
  console.log(" TABLE ROW COUNT COMPARISON");
  console.log(" Source (belconnect_test) vs Restored (belconnect_restore_test)");
  console.log("================================================================================");
  console.log("Table Name".padEnd(35) + "Source".padStart(12) + "Restored".padStart(12) + "   Status");
  console.log("-".repeat(70));

  let mismatches = 0;
  let totalRows = 0;

  for (const table of tables) {
    const q1 = await c1.query(`SELECT count(*)::bigint as cnt FROM public."${table}"`);
    const q2 = await c2.query(`SELECT count(*)::bigint as cnt FROM public."${table}"`);
    const count1 = Number(q1.rows[0].cnt);
    const count2 = Number(q2.rows[0].cnt);
    totalRows += count1;
    const match = count1 === count2;
    if (!match) mismatches++;
    console.log(
      table.padEnd(35) +
        count1.toString().padStart(12) +
        count2.toString().padStart(12) +
        "   " +
        (match ? "[OK MATCH]" : "[MISMATCH]")
    );
  }

  console.log("================================================================================");
  console.log(
    `SUMMARY: ${tables.length} tables compared. Total rows: ${totalRows}. Mismatches: ${mismatches}`
  );
  console.log("================================================================================");

  await c1.end();
  await c2.end();
}

compareDatabases().catch((err) => {
  console.error("Comparison error:", err);
  process.exit(1);
});

