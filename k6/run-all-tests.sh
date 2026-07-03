#!/bin/bash
# k6/run-all-tests.sh
set -e
BASE_URL="${BASE_URL:-http://localhost:3000}"
echo "=========================================="
echo "PropFlow Phase 3: Concurrency & Load Tests"
echo "Base URL: $BASE_URL"
echo "=========================================="

echo ""; echo "🧪 Test 1: STK Push Storm (500 concurrent)"
k6 run --env BASE_URL=$BASE_URL k6/stk-push-storm.js

echo ""; echo "🧪 Test 2: Daraja Callback Flood (1,000 concurrent)"
k6 run --env BASE_URL=$BASE_URL k6/daraja-callback-flood.js

echo ""; echo "🧪 Test 3: Race Condition Test"
k6 run --env BASE_URL=$BASE_URL k6/race-condition-test.js

echo ""; echo "🧪 Test 4: Mixed Load (2,000 concurrent, 15 min)"
k6 run --env BASE_URL=$BASE_URL k6/mixed-load.js

echo ""; echo "=========================================="
echo "✅ All Phase 3 tests complete!"
echo "=========================================="