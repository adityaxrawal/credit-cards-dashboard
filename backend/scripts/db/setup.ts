import fs from 'fs';
import path from 'path';
import pool from '../lib/db';

const setupDatabase = async () => {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Running schema migration...');
    await pool.query(schemaSql);
    console.log('Schema migration completed successfully.');
  } catch (error) {
    console.error('Error running schema migration:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

setupDatabase();
