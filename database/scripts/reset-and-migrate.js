require("dotenv").config({ path: "../../.env" });
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

/**
 * Reset Supabase Database and Apply All Migrations
 * WARNING: This will DELETE ALL DATA in the database!
 */

async function resetDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();
    console.log("✅ Connected to Supabase database");

    // Step 1: Drop all existing tables and objects
    console.log("\n🗑️  Dropping all existing tables and objects...");

    // First, get all tables
    const tablesResult = await client.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `);

    if (tablesResult.rows.length > 0) {
      console.log(`   Found ${tablesResult.rows.length} tables to drop`);
      for (const row of tablesResult.rows) {
        await client.query(`DROP TABLE IF EXISTS "${row.tablename}" CASCADE`);
        console.log(`   ✓ Dropped table: ${row.tablename}`);
      }
    }

    // Drop user-defined functions (skip extension functions)
    const functionsResult = await client.query(`
      SELECT p.proname, n.nspname
      FROM pg_proc p
      INNER JOIN pg_namespace n ON p.pronamespace = n.oid
      LEFT JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
      WHERE n.nspname = 'public' AND d.objid IS NULL
    `);

    if (functionsResult.rows.length > 0) {
      console.log(
        `\n   Found ${functionsResult.rows.length} user-defined functions to drop`
      );
      for (const row of functionsResult.rows) {
        try {
          await client.query(
            `DROP FUNCTION IF EXISTS "${row.proname}" CASCADE`
          );
          console.log(`   ✓ Dropped function: ${row.proname}`);
        } catch (err) {
          // Skip if function is owned by an extension
          console.log(`   ⏭️  Skipped: ${row.proname}`);
        }
      }
    }

    // Drop all sequences
    const sequencesResult = await client.query(`
      SELECT sequencename FROM pg_sequences WHERE schemaname = 'public'
    `);

    if (sequencesResult.rows.length > 0) {
      console.log(
        `\n   Found ${sequencesResult.rows.length} sequences to drop`
      );
      for (const row of sequencesResult.rows) {
        await client.query(
          `DROP SEQUENCE IF EXISTS "${row.sequencename}" CASCADE`
        );
      }
    }

    // Drop all views
    const viewsResult = await client.query(`
      SELECT viewname FROM pg_views WHERE schemaname = 'public'
    `);

    if (viewsResult.rows.length > 0) {
      console.log(`\n   Found ${viewsResult.rows.length} views to drop`);
      for (const row of viewsResult.rows) {
        await client.query(`DROP VIEW IF EXISTS "${row.viewname}" CASCADE`);
      }
    }

    console.log("\n✅ All database objects dropped successfully");

    // Step 2: Get all migration files in order
    const migrationsDir = path.join(__dirname, "../migrations");
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort(); // Sort to ensure correct order

    console.log(`\n📂 Found ${migrationFiles.length} migration files`);

    // Step 3: Apply each migration
    for (const file of migrationFiles) {
      // Skip rollback migration
      if (file.includes("rollback")) {
        console.log(`⏭️  Skipping: ${file}`);
        continue;
      }

      console.log(`\n▶️  Running migration: ${file}`);
      const migrationPath = path.join(migrationsDir, file);
      let migrationSQL = fs.readFileSync(migrationPath, "utf8");

      try {
        // Handle CONCURRENTLY indexes - remove CONCURRENTLY for initial setup
        if (migrationSQL.includes("CONCURRENTLY")) {
          console.log(
            `   ℹ️  Removing CONCURRENTLY flag for initial migration`
          );
          migrationSQL = migrationSQL.replace(
            /CREATE INDEX CONCURRENTLY/gi,
            "CREATE INDEX"
          );
        }

        await client.query(migrationSQL);
        console.log(`✅ Completed: ${file}`);
      } catch (error) {
        console.error(`❌ Error in ${file}:`, error.message);
        throw error;
      }
    }

    // Step 4: Verify database state
    console.log("\n🔍 Verifying database state...");
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log(
      `\n✅ Database reset complete! ${result.rows.length} tables created:`
    );
    result.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.table_name}`);
    });

    console.log("\n🎉 All migrations applied successfully!");
  } catch (error) {
    console.error("\n❌ Database reset failed:", error.message);
    console.error("\nFull error:", error);
    process.exit(1);
  } finally {
    await client.end();
    console.log("\n🔌 Database connection closed");
  }
}

// Confirmation prompt
console.log(
  "⚠️  WARNING: This will DELETE ALL DATA in your Supabase database!"
);
console.log("⚠️  This action cannot be undone!");
console.log(
  "\nDatabase:",
  process.env.DATABASE_URL?.replace(/:[^:]*@/, ":****@")
);
console.log("\nPress Ctrl+C to cancel, or wait 5 seconds to proceed...\n");

setTimeout(() => {
  resetDatabase();
}, 5000);
