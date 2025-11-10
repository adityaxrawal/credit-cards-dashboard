require("dotenv").config({ path: "../../.env" });
const { Client } = require("pg");

async function testConnection() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();
    console.log("✅ Connection successful!");

    const result = await client.query(`
      SELECT COUNT(*) as table_count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `);

    console.log("📊 Tables in database:", result.rows[0].table_count);

    // Get sample of table names
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name 
      LIMIT 10
    `);

    console.log("\n📋 Sample tables:");
    tables.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. ${row.table_name}`);
    });

    console.log("\n✅ Database is ready for use!");
  } catch (error) {
    console.error("❌ Connection failed:", error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

testConnection();
