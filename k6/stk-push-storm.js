// k6/stk-push-storm.js
// Load test: 500 concurrent STK Push initiations
// Target: < 5% error rate, < 3s p95 latency

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const stkPushErrorRate = new Rate('stk_push_errors');
const stkPushLatency = new Trend('stk_push_latency');
const duplicateBlockRate = new Rate('duplicate_blocks');

export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '3m', target: 500 },
    { duration: '5m', target: 500 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    'stk_push_errors': ['rate<0.05'],
    'stk_push_latency': ['p(95)<3000'],
    'http_req_duration': ['p(95)<3000'],
    'http_req_failed': ['rate<0.05'],
  },
};

const TENANTS = Array.from({ length: 500 }, (_, i) => ({
  tenantId: `test-tenant-${i}`,
  buildingId: `test-building-${i % 10}`,
  phone: `2547${String(10000000 + i).slice(0, 8)}`,
  amount: 15000 + (i % 5000),
  unitNumber: `A${i % 50}`,
}));

export default function () {
  const tenant = TENANTS[__VU % TENANTS.length];
  group('STK Push Initiation', () => {
    const payload = JSON.stringify({
      tenantId: tenant.tenantId, buildingId: tenant.buildingId,
      phone: tenant.phone, amount: tenant.amount, unitNumber: tenant.unitNumber,
    });
    const start = Date.now();
    const res = http.post(`${__ENV.BASE_URL}/tenant/pay/actions`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    const latency = Date.now() - start;
    stkPushLatency.add(latency);
    stkPushErrorRate.add(res.status !== 200);

    check(res, {
      'status is 200': (r) => r.status === 200,
      'response has success': (r) => {
        try { const b = JSON.parse(r.body); return b.success === true || b.success === false; }
        catch { return false; }
      },
      'duplicate blocked or success': (r) => {
        try {
          const b = JSON.parse(r.body);
          const isSuccess = b.success === true;
          const isBlocked = b.error && b.error.includes('wait');
          if (isBlocked) duplicateBlockRate.add(1);
          return isSuccess || isBlocked;
        } catch { return false; }
      },
    });
  });
  sleep(Math.random() * 2 + 1);
}