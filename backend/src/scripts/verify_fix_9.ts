import axios from 'axios';
import { env } from '../config/env';

// We assume the server is running or we can start it. 
// For verification scripts usually we need the app to be up.
// But we can import `app` and listen on a random port for test.
import app from '../app';
import http from 'http';

async function verifyMetrics() {
    const server = http.createServer(app);
    const PORT = 3001; // Test part

    server.listen(PORT, async () => {
        console.log(`Test server running on port ${PORT}`);
        const baseUrl = `http://localhost:${PORT}`;

        try {
            // 1. Generate Traffic
            console.log('Generating traffic...');
            await axios.get(`${baseUrl}/health`);
            await axios.get(`${baseUrl}/health`);
            try { await axios.get(`${baseUrl}/api/nonExistentRoute`); } catch (e) { } // 404

            // 2. Fetch Metrics
            console.log('Fetching metrics...');
            const res = await axios.get(`${baseUrl}/api/admin/metrics`);
            const metrics = res.data;

            console.log('Metrics Response:', JSON.stringify(metrics, null, 2));

            // 3. Assertions
            if (!metrics.system || !metrics.database || !metrics.http) {
                console.error('❌ Missing metric sections');
                process.exit(1);
            }
            if (metrics.database.totalCount === undefined) {
                console.error('❌ Missing DB stats');
                process.exit(1);
            }
            if (metrics.http.totalRequests < 2) {
                console.error('❌ HTTP request count too low');
                process.exit(1);
            }

            console.log('✅ Metrics verified successfully.');
            server.close();
            process.exit(0);

        } catch (error) {
            console.error('❌ Verification failed:', error);
            server.close();
            process.exit(1);
        }
    });
}

verifyMetrics();
