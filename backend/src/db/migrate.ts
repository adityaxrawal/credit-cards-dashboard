import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';

const runMigration = async () => {
  const client = new Client({
    connectionString: env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database');

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Executing schema...');
    await client.query(schemaSql);
    console.log('Schema executed successfully');

    // Run Migrations from migrations folder
    const migrationsDir = path.join(__dirname, 'migrations');
    if (fs.existsSync(migrationsDir)) {
      console.log('Checking for migrations...');
      const files = fs.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort(); // Ensure order by filename (001, 002, etc.)

      for (const file of files) {
        console.log(`Executing migration: ${file}`);
        const migrationPath = path.join(migrationsDir, file);
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');
        await client.query(migrationSql);
        console.log(`Completed migration: ${file}`);
      }
    }

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
};

runMigration();
