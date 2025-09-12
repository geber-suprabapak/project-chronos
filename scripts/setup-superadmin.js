#!/usr/bin/env node

/**
 * CLI script to set up the first superadmin user
 * Usage: node scripts/setup-superadmin.js <email>
 */

import { createSuperadmin } from '../src/server/lib/setup-superadmin.js';

async function main() {
  const email = process.argv[2];
  
  if (!email) {
    console.error('Usage: node scripts/setup-superadmin.js <email>');
    console.error('Example: node scripts/setup-superadmin.js admin@example.com');
    process.exit(1);
  }

  if (!email.includes('@')) {
    console.error('❌ Please provide a valid email address');
    process.exit(1);
  }

  console.log('🚀 Setting up superadmin user...');
  console.log('📧 Email:', email);
  
  try {
    await createSuperadmin(email);
    console.log('✅ Superadmin setup completed successfully!');
    console.log('🎉 You can now access the admin management interface at /admin');
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);