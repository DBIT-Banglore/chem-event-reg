#!/usr/bin/env node

/**
 * Admin Panel API Test Script
 *
 * Tests that admin panel API calls work correctly with the CORS configuration.
 * This simulates what the admin panel does when it makes API requests.
 */

const https = require('https');

const DEFAULT_HOST = 'chem-event.netlify.app';
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function testAdminAPI(endpoint, method = 'GET', body = null, authToken = null) {
  return new Promise((resolve) => {
    const options = {
      hostname: DEFAULT_HOST,
      port: 443,
      path: endpoint.startsWith('/') ? endpoint : '/' + endpoint,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Origin': `https://${DEFAULT_HOST}`
      }
    };

    if (authToken) {
      options.headers['x-admin-token'] = authToken;
    }

    if (body) {
      options.body = JSON.stringify(body);
    }

    log(`\n🧪 Testing: ${method} ${endpoint}`, colors.blue);
    if (authToken) {
      log(`🔑 Using auth token: ${authToken.substring(0, 20)}...`, colors.yellow);
    }

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        log(`\n📊 Response Status: ${res.statusCode}`, colors.yellow);

        // Check CORS headers
        const corsHeaders = {
          'access-control-allow-origin': res.headers['access-control-allow-origin'],
          'access-control-allow-methods': res.headers['access-control-allow-methods'],
          'access-control-allow-headers': res.headers['access-control-allow-headers']
        };

        log('\n🔒 CORS Headers:', colors.magenta);
        Object.entries(corsHeaders).forEach(([key, value]) => {
          if (value) {
            log(`  ✓ ${key}: ${value}`, colors.green);
          } else {
            log(`  ✗ ${key}: (not set)`, colors.red);
          }
        });

        // Analyze response
        log('\n📋 Analysis:', colors.magenta);

        if (res.statusCode === 200) {
          log('  ✅ Request succeeded!', colors.green);
          try {
            const jsonData = JSON.parse(data);
            if (jsonData.events) {
              log(`  📡 Found ${jsonData.events.length} events`, colors.blue);
            } else if (jsonData.students) {
              log(`  👥 Found ${jsonData.students.students?.length || 0} students`, colors.blue);
            } else if (jsonData.error) {
              log(`  ❌ API Error: ${jsonData.error}`, colors.red);
            } else {
              log(`  📦 Response: ${JSON.stringify(jsonData).substring(0, 100)}...`, colors.blue);
            }
          } catch (e) {
            log(`  📄 Raw response: ${data.substring(0, 100)}...`, colors.blue);
          }
        } else if (res.statusCode === 401) {
          log('  🔒 Authentication required', colors.yellow);
          log('  💡 This is expected without a valid Firebase token', colors.blue);
        } else if (res.statusCode === 403) {
          log('  🚫 Access forbidden - CORS or auth issue', colors.red);
          log('  💡 Check ALLOWED_ORIGINS and admin token', colors.yellow);
        } else if (res.statusCode === 404) {
          log('  📭 Resource not found', colors.yellow);
        } else {
          log(`  ⚠️  Unexpected status: ${res.statusCode}`, colors.yellow);
          if (data) {
            log(`  📄 Response: ${data.substring(0, 200)}`, colors.blue);
          }
        }

        resolve();
      });
    });

    req.on('error', (error) => {
      log(`\n❌ Request failed: ${error.message}`, colors.red);
      resolve();
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

// Main execution
async function main() {
  log('🔧 Admin Panel API Tester', colors.green);
  log('═'.repeat(50), colors.magenta);

  // Test 1: Public events endpoint (should work without auth)
  log('\n📋 Test 1: Public Events API (no auth required)', colors.magenta);
  await testAdminAPI('/api/events');

  // Test 2: Admin events endpoint (requires auth)
  log('\n\n📋 Test 2: Admin Events API (auth required)', colors.magenta);
  await testAdminAPI('/api/admin/events', 'GET', null, 'test-firebase-token');

  // Test 3: Admin students endpoint (requires auth)
  log('\n\n📋 Test 3: Admin Students API (auth required)', colors.magenta);
  await testAdminAPI('/api/admin/students', 'GET', null, 'test-firebase-token');

  // Test 4: Create event (requires auth)
  log('\n\n📋 Test 4: Create Event API (auth required)', colors.magenta);
  await testAdminAPI('/api/admin/events', 'POST', {
    idToken: 'test-firebase-token',
    name: 'Test Event',
    description: 'Test description',
    capacity: 50,
    dateTime: new Date().toISOString(),
    price: 0,
    isActive: true
  }, 'test-firebase-token');

  log('\n' + '═'.repeat(50), colors.magenta);
  log('✅ Admin API tests completed!', colors.green);
  log('\n💡 Tips:', colors.blue);
  log('  • Same-origin requests should always work', colors.reset);
  log('  • Admin endpoints require Firebase auth token', colors.reset);
  log('  • Public endpoints work without auth', colors.reset);
}

main().catch(console.error);