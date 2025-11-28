import pool from '../src/db';

async function main() {
  const jobId = process.argv[2];
  if (!jobId) {
    console.error('Please provide a job ID');
    process.exit(1);
  }

  try {
    const { rows } = await pool.query('SELECT * FROM scan_jobs WHERE id = $1', [jobId]);
    if (rows.length > 0) {
      console.log('Job Status:', rows[0]);
    } else {
      console.log('Job not found');
    }
  } catch (error) {
    console.error('Error fetching job:', error);
  } finally {
    await pool.end();
  }
}

main();
