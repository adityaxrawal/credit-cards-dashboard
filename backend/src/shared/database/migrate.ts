
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { env } from '@shared/config/env';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

const runMigration = async () => {
  const client = new Client({
    connectionString: env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // 1. Create migrations table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        run_on TIMESTAMP DEFAULT NOW()
      );
    `);

    // 2. Get list of files
    if (!fs.existsSync(MIGRATIONS_DIR)) {
      console.log('No migrations directory found.');
      return;
    }

    const files = fs.readdirSync(MIGRATIONS_DIR).sort();
    console.log(`Found ${files.length} migration files.`);

    // 3. Get executed migrations
    const res = await client.query('SELECT name FROM _migrations');
    const executed = new Set(res.rows.map(r => r.name));

    // 4. Run pending migrations
    for (const file of files) {
      if (!file.endsWith('.sql')) continue;

      if (executed.has(file)) {
        // console.log(`Skipping ${file} (already executed)`);
        continue;
      }

      console.log(`Running migration: ${file}...`);
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`Successfully applied ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Failed to apply ${file}:`, err);
        process.exit(1);
      }
    }

    console.log('All migrations checked/applied.');

  } catch (err) {
    console.error('Migration script failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
};

runMigration();
