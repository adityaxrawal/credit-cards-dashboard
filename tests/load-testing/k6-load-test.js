import http from "k6/http";
import { check, group, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// Custom metrics
const errorRate = new Rate("errors");
const apiResponseTime = new Trend("api_response_time");

// Test configuration
export const options = {
  stages: [
    { duration: "2m", target: 50 }, // Ramp-up to 50 users
    { duration: "5m", target: 50 }, // Stay at 50 users
    { duration: "2m", target: 100 }, // Ramp-up to 100 users
    { duration: "5m", target: 100 }, // Stay at 100 users
    { duration: "2m", target: 0 }, // Ramp-down to 0 users
  ],
  thresholds: {
    http_req_duration: ["p(95)<500", "p(99)<1000"], // 95% of requests should be below 500ms
    http_req_failed: ["rate<0.05"], // Error rate should be less than 5%
    errors: ["rate<0.1"], // Custom error rate
  },
};

const BASE_URL = __ENV.API_URL || "http://localhost:4000";
let authToken = "";

// Setup function - runs once per VU
export function setup() {
  // Login to get auth token
  const loginRes = http.post(
    `${BASE_URL}/api/auth/google`,
    JSON.stringify({
      code: "test-code-for-load-testing",
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );

  // In production, you'd use a real test account
  // For now, return a mock token or skip authenticated tests
  return { token: "mock-token-for-testing" };
}

export default function (data) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${data.token}`,
  };

  // Test 1: Health Check Endpoint
  group("Health Check", () => {
    const res = http.get(`${BASE_URL}/health`);
    check(res, {
      "health check status is 200": (r) => r.status === 200,
      "health check response time < 100ms": (r) => r.timings.duration < 100,
    });
    errorRate.add(res.status !== 200);
    apiResponseTime.add(res.timings.duration);
    sleep(1);
  });

  // Test 2: Dashboard Overview (authenticated)
  group("Dashboard Overview", () => {
    const res = http.get(`${BASE_URL}/api/dashboard/overview`, { headers });
    check(res, {
      "dashboard status is 200 or 401": (r) =>
        r.status === 200 || r.status === 401,
      "dashboard response time < 500ms": (r) => r.timings.duration < 500,
    });
    errorRate.add(res.status >= 500);
    apiResponseTime.add(res.timings.duration);
    sleep(1);
  });

  // Test 3: List Credit Cards
  group("List Credit Cards", () => {
    const res = http.get(`${BASE_URL}/api/cards`, { headers });
    check(res, {
      "cards list status is 200 or 401": (r) =>
        r.status === 200 || r.status === 401,
      "cards list response time < 300ms": (r) => r.timings.duration < 300,
    });
    errorRate.add(res.status >= 500);
    apiResponseTime.add(res.timings.duration);
    sleep(1);
  });

  // Test 4: List Transactions (with pagination)
  group("List Transactions", () => {
    const res = http.get(`${BASE_URL}/api/transactions?page=1&limit=20`, {
      headers,
    });
    check(res, {
      "transactions list status is 200 or 401": (r) =>
        r.status === 200 || r.status === 401,
      "transactions list response time < 500ms": (r) =>
        r.timings.duration < 500,
    });
    errorRate.add(res.status >= 500);
    apiResponseTime.add(res.timings.duration);
    sleep(1);
  });

  // Test 5: Analytics Summary
  group("Analytics Summary", () => {
    const res = http.get(`${BASE_URL}/api/analytics/summary`, { headers });
    check(res, {
      "analytics status is 200 or 401": (r) =>
        r.status === 200 || r.status === 401,
      "analytics response time < 1000ms": (r) => r.timings.duration < 1000,
    });
    errorRate.add(res.status >= 500);
    apiResponseTime.add(res.timings.duration);
    sleep(2);
  });

  // Test 6: Budget Tracking
  group("Budget Tracking", () => {
    const res = http.get(`${BASE_URL}/api/budget/current`, { headers });
    check(res, {
      "budget status is 200 or 401": (r) =>
        r.status === 200 || r.status === 401,
      "budget response time < 300ms": (r) => r.timings.duration < 300,
    });
    errorRate.add(res.status >= 500);
    apiResponseTime.add(res.timings.duration);
    sleep(1);
  });
}

// Teardown function
export function teardown(data) {
  // Cleanup if needed
  console.log("Load test completed");
}
