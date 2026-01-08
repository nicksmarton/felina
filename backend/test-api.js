/**
 * Simple API Testing Script
 * Run with: node test-api.js
 */

const API_BASE = 'http://localhost:3000';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

async function test(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const method = options.method || 'GET';
  const body = options.body ? JSON.stringify(options.body) : undefined;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.token && { Authorization: `Bearer ${options.token}` }),
    ...options.headers,
  };

  try {
    const response = await fetch(url, { method, headers, body });
    const data = await response.json();
    
    const status = response.ok ? '✓' : '✗';
    const color = response.ok ? colors.green : colors.red;
    
    console.log(`${color}${status}${colors.reset} ${method} ${endpoint} - ${response.status}`);
    
    if (!response.ok) {
      console.log(`   Error: ${data.error?.message || 'Unknown error'}`);
    }
    
    return { ok: response.ok, data, status: response.status };
  } catch (error) {
    console.log(`${colors.red}✗${colors.reset} ${method} ${endpoint} - ERROR`);
    console.log(`   ${error.message}`);
    return { ok: false, error: error.message };
  }
}

async function runTests() {
  console.log(`${colors.blue}=== MeowFi Backend API Tests ===${colors.reset}\n`);

  // Test 1: Health Check
  console.log(`${colors.yellow}1. Testing Health Endpoint${colors.reset}`);
  await test('/health');
  console.log('');

  // Test 2: Token Info (should work without auth)
  console.log(`${colors.yellow}2. Testing Token Endpoints${colors.reset}`);
  await test('/api/v1/token/info');
  await test('/api/v1/token/rate');
  console.log('');

  // Test 3: Analytics (should work without auth)
  console.log(`${colors.yellow}3. Testing Analytics Endpoints${colors.reset}`);
  await test('/api/v1/analytics/overview');
  await test('/api/v1/transactions/stats/summary');
  console.log('');

  // Test 4: Transactions (should work without auth)
  console.log(`${colors.yellow}4. Testing Transaction Endpoints${colors.reset}`);
  await test('/api/v1/transactions?page=1&limit=10');
  console.log('');

  // Test 5: Leaderboard
  console.log(`${colors.yellow}5. Testing Leaderboard Endpoints${colors.reset}`);
  await test('/api/v1/leaderboard/ALL_TIME?limit=10');
  console.log('');

  // Test 6: Authentication (will fail without valid signature, but should return proper error)
  console.log(`${colors.yellow}6. Testing Authentication Endpoints${colors.reset}`);
  await test('/api/v1/auth/wallet/connect', {
    method: 'POST',
    body: {
      walletAddress: '0x0000000000000000000000000000000000000000',
      signature: 'invalid',
      message: 'test',
    },
  });
  console.log('');

  // Test 7: Protected Endpoints (should return 401 without token)
  console.log(`${colors.yellow}7. Testing Protected Endpoints (should fail without auth)${colors.reset}`);
  await test('/api/v1/users/me');
  console.log('');

  console.log(`${colors.blue}=== Tests Complete ===${colors.reset}`);
  console.log('\nNote: Some endpoints may fail if database is not set up or empty.');
  console.log('This is normal for a fresh installation.');
}

// Check if fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
  console.error('This script requires Node.js 18+ with native fetch support.');
  console.error('Alternatively, install node-fetch: npm install node-fetch');
  process.exit(1);
}

runTests().catch(console.error);

