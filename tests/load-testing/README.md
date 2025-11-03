# Load Testing Suite

Comprehensive load testing infrastructure for the Credit Card Dashboard application.

## 🎯 Overview

This directory contains load testing scripts and tools to evaluate system performance, identify bottlenecks, and ensure the application can handle expected traffic loads.

## 🛠️ Tools Used

- **k6:** Modern load testing tool for API and microservices
- **Artillery:** Flexible load testing toolkit with scenario-based testing

## 📁 Files

- `k6-load-test.js` - Baseline load test (50-100 concurrent users)
- `k6-stress-test.js` - Stress test to find breaking points (up to 300 users)
- `k6-spike-test.js` - Spike test for sudden traffic surges (50 → 500 users)
- `k6-soak-test.js` - Sustained load test (100 users for 60 minutes)
- `artillery-test.yml` - Artillery scenario-based testing configuration
- `artillery-processor.js` - Custom functions for Artillery tests
- `generate-report.js` - Report generation script
- `package.json` - NPM scripts and dependencies

## 🚀 Quick Start

### Prerequisites

```bash
# Install k6 (macOS)
brew install k6

# Or download from: https://k6.io/docs/getting-started/installation/

# Install Artillery globally
npm install -g artillery

# Or install locally in this directory
npm install
```

### Running Tests

```bash
# Set the API URL (default: http://localhost:4000)
export API_URL=http://localhost:4000

# Run baseline load test
k6 run k6-load-test.js

# Run stress test
k6 run k6-stress-test.js

# Run spike test
k6 run k6-spike-test.js

# Run soak test (1 hour - best run overnight)
k6 run k6-soak-test.js

# Run Artillery scenario test
artillery run artillery-test.yml

# Generate report
node generate-report.js
```

### NPM Scripts

```bash
npm run test:load        # Run baseline load test
npm run test:load:stress # Run stress test
npm run test:load:spike  # Run spike test
npm run test:load:soak   # Run soak test
npm run test:artillery   # Run Artillery test
npm run report           # Generate report
```

## 📊 Test Scenarios

### 1. Baseline Load Test

Tests normal operating conditions with gradual user ramp-up.

- **Users:** 50-100 concurrent
- **Duration:** 16 minutes
- **Purpose:** Establish performance baseline

### 2. Stress Test

Pushes system beyond normal capacity to find breaking points.

- **Users:** 100-300 concurrent
- **Duration:** 21 minutes
- **Purpose:** Identify maximum capacity

### 3. Spike Test

Simulates sudden traffic surge (e.g., marketing campaign, viral content).

- **Users:** 50 → 500 (30 seconds)
- **Duration:** 5.5 minutes
- **Purpose:** Test auto-scaling and recovery

### 4. Soak Test

Extended duration test to identify memory leaks and degradation.

- **Users:** 100 concurrent
- **Duration:** 70 minutes
- **Purpose:** Detect long-term stability issues

## 🎯 Performance Targets

| Metric            | Target   | Rationale                      |
| ----------------- | -------- | ------------------------------ |
| p95 Response Time | < 500ms  | Good user experience           |
| p99 Response Time | < 1000ms | Acceptable for 99% of requests |
| Error Rate        | < 1%     | High reliability               |
| Concurrent Users  | 500+     | Support growth                 |
| Uptime            | 99.9%    | Production-grade reliability   |

## 📈 Interpreting Results

### k6 Output Metrics

```
http_req_duration...: avg=245ms min=12ms med=231ms max=1.2s p(90)=312ms p(95)=421ms
http_req_failed.....: 0.23% ✓ 45 ✗ 19503
http_reqs...........: 19548 326.46/s
```

**Key Metrics:**

- **http_req_duration:** Response times (lower is better)
- **http_req_failed:** Error rate percentage (lower is better)
- **http_reqs:** Total requests and requests per second (throughput)
- **p(95), p(99):** 95th and 99th percentile response times

### What to Look For

✅ **Good Signs:**

- Stable response times across test duration
- Low error rates (< 1%)
- System recovers quickly after spikes
- No memory leaks in soak tests

⚠️ **Warning Signs:**

- Increasing response times over time
- Error rates above 5%
- Failed health checks
- Timeouts under normal load

## 🔧 Troubleshooting

### High Response Times

1. Check database query performance
2. Review Redis cache hit rates
3. Analyze slow API endpoints
4. Check network latency

### High Error Rates

1. Review application logs
2. Check database connection limits
3. Verify rate limiting configuration
4. Monitor memory usage

### System Crashes

1. Check Cloud Run auto-scaling configuration
2. Review memory limits and allocation
3. Analyze crash logs in Google Cloud Logging
4. Verify database connection pool settings

## 🔗 Integration with CI/CD

Add load testing to your CI/CD pipeline:

```yaml
# .github/workflows/load-test.yml
name: Load Test
on:
  schedule:
    - cron: "0 2 * * 0" # Weekly on Sunday at 2 AM
  workflow_dispatch: # Manual trigger

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install k6
        run: |
          sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6
      - name: Run load test
        run: |
          cd tests/load-testing
          k6 run k6-load-test.js --out json=results.json
        env:
          API_URL: ${{ secrets.STAGING_API_URL }}
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: load-test-results
          path: tests/load-testing/results.json
```

## 📚 Resources

- [k6 Documentation](https://k6.io/docs/)
- [Artillery Documentation](https://www.artillery.io/docs)
- [Load Testing Best Practices](https://k6.io/docs/testing-guides/best-practices/)

---

**Last Updated:** November 2024  
**Phase:** 5 - Testing & Launch Preparation
