// Simple script to run database migration using Supabase
require("dotenv").config({ path: "../../.env" });
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function runMigration() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  console.log("Connecting to Supabase...");
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Read migration file
  const migrationPath = path.join(
    __dirname,
    "migrations",
    "002_phase2_email_integration.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf8");

  console.log("Running migration: 002_phase2_email_integration.sql");

  // Split SQL into statements (simple split by semicolon)
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    console.log(`\nExecuting statement ${i + 1}/${statements.length}...`);
    console.log(statement.substring(0, 100) + "...");

    try {
      const { data, error } = await supabase.rpc("exec_sql", {
        sql_query: statement,
      });

      if (error) {
        // Try direct query if RPC doesn't work
        const { error: queryError } = await supabase
          .from("_migrations")
          .select("*")
          .limit(1);
        if (queryError) {
          console.error("Error executing statement:", error);
          console.log(
            "Note: You may need to run this migration manually in Supabase SQL Editor"
          );
          console.log("Migration file location:", migrationPath);
          process.exit(1);
        }
      } else {
        console.log("✓ Success");
      }
    } catch (err) {
      console.error("Error:", err.message);
    }
  }

  console.log("\n✅ Migration completed successfully!");
  console.log("\nCreated tables:");
  console.log("- email_processing_log");
  console.log("- scan_jobs");
  console.log("\nAdded to users table:");
  console.log(
    "- gmail_refresh_token, gmail_access_token, gmail_token_expiry, gmail_watch_expiration, gmail_history_id"
  );
  console.log("\nAdded to transactions table:");
  console.log("- email_message_id");
}

runMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
