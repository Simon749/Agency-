#!/usr/bin/env node
/**
 * Seed runner wrapper - bypasses tsx by using direct Node.js
 * This is a workaround for Windows esbuild spawn issues
 */

require('dotenv').config({ path: '.env.local' });

const path = require('path');
const Module = require('module');

// Enable ES module support
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
  if (id.startsWith('.') && id.endsWith('.ts')) {
    // Convert .ts imports to use tsx or ts-node
    return originalRequire.call(this, id);
  }
  return originalRequire.call(this, id);
};

// Alternative: use ts-node if available
try {
  require('ts-node').register({
    transpileOnly: true,
    compilerOptions: {
      module: 'commonjs'
    }
  });
  
  console.log('✓ ts-node registered');
  
  // Now require the seed file
  const seed = require('./db/seed.ts');
  
  if (typeof seed.seed === 'function') {
    seed.seed().catch(err => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
  }
} catch (err) {
  console.error('Error:', err.message);
  console.error('\nNote: You may need to configure DATABASE_URL in .env.local first');
  process.exit(1);
}
