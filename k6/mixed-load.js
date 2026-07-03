// k6/mixed-load.js
// Mixed scenario: 2,000 concurrent users over 15 minutes

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const apiErrorRate = new Rate('api_errors');
const apiLatency = new Trend('api_latency');

export const options = {
  stages: [
    { duration: '3m', target: 500 },
    { duration: '5m', target: 2000 },
    { duration: '5m', target: 2000 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    'api_errors': ['rate<0.01'],
    'api_latency': ['p(95)<3000'],
    'http_req_failed': ['rate<0.01'],
  },
};

const SCENARIOS = [
  { weight: 30, name: 'tenant_dashboard' },
  { weight: 25, name: 'admin_tenants_list' },
  { weight: 20, name: 'stk_push_init' },
  { weight: 15, name: 'daraja_callback' },
  { weight: 10, name: 'balance_query' },
];

function pickScenario() {
  const rand = Math.random() * 100;
  let cum = 0;
  for (const s of SCENARIOS) { cum += s.weight; if (rand <= cum) return s.name; }
  return SCENARIOS[0].name;
}

export default function () {
  const scenario = pickScenario();
  const start = Date.now();

  switch (scenario) {
    case 'tenant_dashboard': {
      group('Tenant Dashboard', () => {
        const res = http.get(`${__ENV.BASE_URL}/tenant/dashboard`);
        apiLatency.add(Date.now() - start); apiErrorRate.add(res.status !== 200);
        check(res, { 'dashboard loads': (r) => r.status === 200 });
      }); break;
    }
    case 'admin_tenants_list': {
      group('Admin Tenants List', () => {
        const res = http.get(`${__ENV.BASE_URL}/admin/tenants?page=1`);
        apiLatency.add(Date.now() - start); apiErrorRate.add(res.status !== 200);
        check(res, { 'tenants list loads': (r) => r.status === 200 });
      }); break;
    }
    case 'stk_push_init': {
      group('STK Push', () => {
        const payload = JSON.stringify({
          tenantId: `tenant-${__VU % 500}`, buildingId: `building-${__VU % 10}`,
          phone: `2547${String(10000000 + __VU).slice(0, 8)}`, amount: 15000, unitNumber: 'A1',
        });
        const res = http.post(`${__ENV.BASE_URL}/tenant/pay/actions`, payload, { headers: { 'Content-Type': 'application/json' } });
        apiLatency.add(Date.now() - start); apiErrorRate.add(res.status !== 200);
        check(res, { 'stk push ok': (r) => r.status === 200 });
      }); break;
    }
    case 'daraja_callback': {
      group('Daraja Callback', () => {
        const payload = JSON.stringify({
          stkCallback: {
            MerchantRequestID: `MR_${__VU}`, CheckoutRequestID: `ws_CO_${Date.now()}_${__VU % 200}`,
            ResultCode: 0, ResultDesc: 'Success',
            CallbackMetadata: { Item: [{ Name: 'Amount', Value: 15000 }, { Name: 'MpesaReceiptNumber', Value: `RFI${__VU}` }] },
          },
        });
        const res = http.post(`${__ENV.BASE_URL}/api/webhooks/mpesa/174379`, payload, { headers: { 'Content-Type': 'application/json' } });
        apiLatency.add(Date.now() - start); apiErrorRate.add(res.status !== 200);
        check(res, { 'callback processed': (r) => r.status === 200 });
      }); break;
    }
    case 'balance_query': {
      group('Balance Query', () => {
        const res = http.get(`${__ENV.BASE_URL}/api/tenant/balance?tenantId=tenant-${__VU % 500}`);
        apiLatency.add(Date.now() - start); apiErrorRate.add(res.status !== 200);
        check(res, { 'balance query ok': (r) => r.status === 200 });
      }); break;
    }
  }
  sleep(Math.random() * 3 + 1);
}