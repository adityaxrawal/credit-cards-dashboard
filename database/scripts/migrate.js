require("dotenv").config();
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

async function runMigration(direction = "up") {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();
    console.log("Connected to database");

    if (direction === "up") {
      console.log("Running migrations...");

      // Read and execute migration file
      const migrationPath = path.join(
        __dirname,
        "../migrations/001_initial_schema.sql"
      );
      const migrationSQL = fs.readFileSync(migrationPath, "utf8");

      await client.query(migrationSQL);
      console.log("Migration completed successfully");
    } else {
      console.log("Dropping all tables...");

      // Drop all tables in reverse order
      const dropSQL = `
        DROP TABLE IF EXISTS recurring_transactions CASCADE;
        DROP TABLE IF EXISTS uploaded_statements CASCADE;
        DROP TABLE IF EXISTS bill_payments CASCADE;
        DROP TABLE IF EXISTS reward_points CASCADE;
        DROP TABLE IF EXISTS gmail_tokens CASCADE;
        DROP TABLE IF EXISTS analytics_cache CASCADE;
        DROP TABLE IF EXISTS email_processing_log CASCADE;
        DROP TABLE IF EXISTS alerts CASCADE;
        DROP TABLE IF EXISTS budget_tracking CASCADE;
        DROP TABLE IF EXISTS transactions CASCADE;
        DROP TABLE IF EXISTS credit_cards CASCADE;
        DROP TABLE IF EXISTS users CASCADE;
        DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
      `;

      await client.query(dropSQL);
      console.log("All tables dropped successfully");
    }
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run migration
const direction = process.argv[2] || "up";
runMigration(direction);
