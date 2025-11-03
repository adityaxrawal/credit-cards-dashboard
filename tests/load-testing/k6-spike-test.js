import http from "k6/http";
import { check, sleep } from "k6";

// Spike test - sudden traffic surge
export const options = {
  stages: [
    { duration: "1m", target: 50 }, // Normal load
    { duration: "30s", target: 500 }, // Sudden spike!
    { duration: "2m", target: 500 }, // Maintain spike
    { duration: "1m", target: 50 }, // Return to normal
    { duration: "1m", target: 0 }, // Ramp down
  ],
};

const BASE_URL = __ENV.API_URL || "http://localhost:4000";

export default function () {
  const res = http.get(`${BASE_URL}/api/dashboard/overview`);
  check(res, {
    "system handles spike": (r) => r.status < 500,
  });
  sleep(1);
}
