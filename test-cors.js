#!/usr/bin/env node

/**
 * CORS Testing Script
 *
 * This script tests the CORS configuration of your Chem Event Reg application.
 * It verifies that:
 * 1. Allowed origins can access the API
 * 2. Disallowed origins are properly rejected
 * 3. Proper CORS headers are returned
 *
 * Usage:
 *   node test-cors.js <origin> <endpoint>
 *
 * Examples:
 *   node test-cors.js https://chem-event.netlify.app /api/events
 *   node test-cors.js http://evil.com /api/events
 */

const https = require('https');

// Configuration
const DEFAULT_HOST = 'chem-event.netlify.app';
const DEFAULT_ENDPOINT = '/api/events';

// ANSI color codes for output
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

function testCORS(origin, endpoint) {
  return new Promise((resolve) => {
    const options = {
      hostname: DEFAULT_HOST,
      port: 443,
      path: endpoint.startsWith('/') ? endpoint : '/' + endpoint,
      method: 'OPTIONS',
      headers: {
        'Origin': origin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    };

    log(`\n🧪 Testing CORS for: ${origin}`, colors.blue);
    log(`📡 Endpoint: ${endpoint}`, colors.blue);
    log('─'.repeat(50), colors.magenta);

    const req = https.request(options, (res) => {
      const headers = res.headers;

      log(`\n📊 Response Status: ${res.statusCode}`, colors.yellow);

      // Check CORS headers
      const corsHeaders = {
        'Access-Control-Allow-Origin': headers['access-control-allow-origin'],
        'Access-Control-Allow-Methods': headers['access-control-allow-methods'],
        'Access-Control-Allow-Headers': headers['access-control-allow-headers'],
        'Access-Control-Allow-Credentials': headers['access-control-allow-credentials'],
        'Access-Control-Max-Age': headers['access-control-max-age']
      };

      log('\n🔒 CORS Headers:', colors.magenta);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        if (value) {
          log(`  ✓ ${key}: ${value}`, colors.green);
        } else {
          log(`  ✗ ${key}: (not set)`, colors.red);
        }
      });

      // Analyze results
      log('\n📋 Analysis:', colors.magenta);

      if (res.statusCode === 403) {
        log('  ❌ Request BLOCKED - Origin not allowed', colors.red);
        log('  ✅ CORS protection is working correctly!', colors.green);
      } else if (res.statusCode === 200) {
        if (corsHeaders['Access-Control-Allow-Origin'] === origin) {
          log('  ✅ Request ALLOWED - Origin is whitelisted', colors.green);
        } else if (corsHeaders['Access-Control-Allow-Origin'] === '*') {
          log('  ⚠️  WARNING - CORS allows all origins (*)', colors.yellow);
          log('  🔒 Recommendation: Restrict to specific origins', colors.yellow);
        } else {
          log('  ⚠️  WARNING - CORS header mismatch', colors.yellow);
        }
      } else {
        log(`  ⚠️  Unexpected status code: ${res.statusCode}`, colors.yellow);
      }

      // Security check
      log('\n🛡️  Security Headers:', colors.magenta);
      const securityHeaders = [
        'x-frame-options',
        'x-content-type-options',
        'strict-transport-security',
        'content-security-policy'
      ];

      securityHeaders.forEach(header => {
        const value = headers[header];
        if (value) {
          log(`  ✓ ${header}: ${value}`, colors.green);
        } else {
          log(`  ✗ ${header}: (not set)`, colors.red);
        }
      });

      resolve();
    });

    req.on('error', (error) => {
      log(`\n❌ Request failed: ${error.message}`, colors.red);
      resolve();
    });

    req.end();
  });
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    log('❌ Error: Missing required arguments', colors.red);
    log('\nUsage: node test-cors.js <origin> [endpoint]', colors.yellow);
    log('\nExamples:', colors.magenta);
    log('  node test-cors.js https://chem-event.netlify.app /api/events', colors.blue);
    log('  node test-cors.js http://evil.com /api/events', colors.blue);
    log('  node test-cors.js http://localhost:3000 /api/events', colors.blue);
    process.exit(1);
  }

  const origin = args[0];
  let endpoint = args[1] || DEFAULT_ENDPOINT;

  // Handle Windows path conversion issue
  // If endpoint looks like a Windows path, use default
  if (endpoint.includes(':') && !endpoint.startsWith('http')) {
    log('⚠️  Warning: Endpoint looks like a Windows path, using default', colors.yellow);
    endpoint = DEFAULT_ENDPOINT;
  }

  // Ensure endpoint starts with /
  if (!endpoint.startsWith('/')) {
    endpoint = '/' + endpoint;
  }

  log('🚀 CORS Configuration Tester', colors.green);
  log('═'.repeat(50), colors.magenta);

  await testCORS(origin, endpoint);

  log('\n' + '═'.repeat(50), colors.magenta);
  log('✅ Test completed!', colors.green);
}

main().catch(console.error);