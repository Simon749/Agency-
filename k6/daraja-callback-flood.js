// k6/daraja-callback-flood.js
// Load test: 1,000 concurrent Daraja callbacks
// Target: 0% duplicate ledger entries, < 2s p95 latency

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const callbackErrorRate = new Rate('callback_errors');
const callbackLatency = new Trend('callback_latency');
const duplicateLedgerEntries = new Counter('duplicate_ledger_entries');
const duplicateCallbacksBlocked = new Counter('duplicate_callbacks_blocked');

export const options = {
  stages: [
    { duration: '1m', target: 200 },
    { duration: '2m', target: 1000 },
    { duration: '5m', target: 1000 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    'callback_errors': ['rate<0.01'],
    'callback_latency': ['p(95)<2000'],
    'duplicate_ledger_entries': ['count==0'],
    'http_req_failed': ['rate<0.01'],
  },
};

const CHECKOUT_IDS = Array.from({ length: 200 }, (_, i) => `ws_CO_${Date.now()}_${i}`);

export default function () {
  const isDuplicate = Math.random() < 0.3;
  const checkoutId = isDuplicate
    ? CHECKOUT_IDS[Math.floor(Math.random() * CHECKOUT_IDS.length)]
    : CHECKOUT_IDS[__VU % CHECKOUT_IDS.length];
  const shortcode = '174379';

  group('Daraja Callback', () => {
    const payload = JSON.stringify({
      stkCallback: {
        MerchantRequestID: `MR_${checkoutId}`, CheckoutRequestID: checkoutId,
        ResultCode: 0, ResultDesc: 'Success',
        CallbackMetadata: {
          Item: [
            { Name: 'Amount', Value: 15000 },
            { Name: 'MpesaReceiptNumber', Value: `RFI${Math.random().toString(36).substring(2, 10).toUpperCase()}` },
            { Name: 'TransactionDate', Value: new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14) },
            { Name: 'PhoneNumber', Value: 254712345678 },
          ],
        },
      },
    });
    const start = Date.now();
    const res = http.post(`${__ENV.BASE_URL}/api/webhooks/mpesa/${shortcode}`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    const latency = Date.now() - start;
    callbackLatency.add(latency);
    callbackErrorRate.add(res.status !== 200);

    check(res, {
      'status is 200': (r) => r.status === 200,
      'no duplicate ledger': (r) => {
        try {
          const b = JSON.parse(r.body);
          const isAlreadyProcessed = b.result && b.result.includes('Already processed');
          if (isAlreadyProcessed) duplicateCallbacksBlocked.add(1);
          const hasNewLedger = b.ledgerId && !isAlreadyProcessed;
          if (hasNewLedger && isDuplicate) { duplicateLedgerEntries.add(1); return false; }
          return true;
        } catch { return false; }
      },
      'fast response': (r) => (Date.now() - start) < 2000,
    });
  });
  sleep(Math.random() * 0.5);
}