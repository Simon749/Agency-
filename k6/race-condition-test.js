// k6/race-condition-test.js
// Explicitly tests double-callback race condition

import http from 'k6/http';
import { check, group } from 'k6';
import { Counter } from 'k6/metrics';

const raceWins = new Counter('race_wins');
const raceDuplicates = new Counter('race_duplicates');
const raceErrors = new Counter('race_errors');

export const options = {
  vus: 100,
  iterations: 1000,
};

export default function () {
  const checkoutId = `RACE_${Math.floor(__ITER / 2)}`;
  const shortcode = '174379';
  const payload = JSON.stringify({
    stkCallback: {
      MerchantRequestID: `MR_${checkoutId}`, CheckoutRequestID: checkoutId,
      ResultCode: 0, ResultDesc: 'Success',
      CallbackMetadata: {
        Item: [
          { Name: 'Amount', Value: 15000 },
          { Name: 'MpesaReceiptNumber', Value: `RACE_RFI_${__ITER}` },
        ],
      },
    },
  });

  group('Race Condition Test', () => {
    const [res1, res2] = http.batch([
      { method: 'POST', url: `${__ENV.BASE_URL}/api/webhooks/mpesa/${shortcode}`, body: payload, headers: { 'Content-Type': 'application/json' } },
      { method: 'POST', url: `${__ENV.BASE_URL}/api/webhooks/mpesa/${shortcode}`, body: payload, headers: { 'Content-Type': 'application/json' } },
    ]);

    const body1 = JSON.parse(res1.body || '{}');
    const body2 = JSON.parse(res2.body || '{}');
    const hasLedger1 = body1.ledgerId != null;
    const hasLedger2 = body2.ledgerId != null;
    const isDup1 = body1.result?.includes('Already processed');
    const isDup2 = body2.result?.includes('Already processed');

    if ((hasLedger1 && isDup2) || (hasLedger2 && isDup1)) raceWins.add(1);
    else if (isDup1 && isDup2) raceDuplicates.add(1);
    else if (hasLedger1 && hasLedger2) { raceErrors.add(1); console.error(`RACE BUG: Both created ledger for ${checkoutId}`); }

    check(null, {
      'no double ledger': () => !(hasLedger1 && hasLedger2),
      'at least one success': () => hasLedger1 || hasLedger2 || isDup1 || isDup2,
    });
  });
}