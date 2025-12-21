#!/usr/bin/env ts-node

/**
 * Run individual migration file (007_add_performance_indexes.sql)
 * This is a one-time script to apply the performance indexes migration
 */

import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';

const runIndexMigration = async () => {
    const client = new Client({
        connectionString: env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('✅ Connected to database');

        const migrationPath = path.join(__dirname, 'migrations', '007_add_performance_indexes.sql');
        console.log(`📄 Reading migration: ${migrationPath}`);

        const migrationSql = fs.readFileSync(migrationPath, 'utf8');

        console.log('🚀 Executing performance indexes migration...');
        await client.query(migrationSql);
        console.log('✅ Performance indexes created successfully!');

        // Verify indexes were created
        console.log('\n📊 Verifying indexes...');
        const indexCheck = await client.query(`
      SELECT tablename, indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
        AND indexname LIKE 'idx_%'
      ORDER BY tablename, indexname;
    `);

        console.log(`\n✅ Found ${indexCheck.rows.length} indexes:`);
        indexCheck.rows.forEach(row => {
            console.log(`   - ${row.tablename}.${row.indexname}`);
        });

    } catch (err: any) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    } finally {
        await client.end();
        console.log('\n✅ Database connection closed');
    }
};

runIndexMigration();
