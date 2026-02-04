#!/usr/bin/env tsx
/**
 * Hackathon Registration Script
 * 
 * Run this once to register the Trading Caller agent with the Colosseum hackathon.
 * 
 * Usage:
 *   npm run hackathon:register
 *   # or
 *   npx tsx scripts/hackathon-register.ts
 */

import 'dotenv/config';
import { registerAgent } from '../agent/hackathon.js';

const AGENT_NAME = 'trading-caller';

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║        Trading Caller - Hackathon Registration               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // Check if already registered
  if (process.env.HACKATHON_API_KEY) {
    console.log('⚠️  HACKATHON_API_KEY already set in environment.');
    console.log('   If you want to re-register, remove it from .env first.');
    console.log('');
    process.exit(1);
  }

  console.log(`Registering agent: ${AGENT_NAME}`);
  console.log('');

  try {
    const result = await registerAgent(AGENT_NAME);

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('✅ REGISTRATION SUCCESSFUL!');
    console.log('');
    console.log('IMPORTANT - Save these values:');
    console.log('');
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│ API KEY (add to .env):                                      │');
    console.log('│                                                             │');
    console.log(`│   HACKATHON_API_KEY=${result.apiKey}`);
    console.log('│                                                             │');
    console.log('│ ⚠️  This key is shown ONCE and cannot be recovered!         │');
    console.log('└─────────────────────────────────────────────────────────────┘');
    console.log('');
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│ CLAIM CODE (give to human for prizes):                      │');
    console.log('│                                                             │');
    console.log(`│   ${result.claimCode}`);
    console.log('│                                                             │');
    console.log('│ Claim URL:                                                  │');
    console.log(`│   ${result.claimUrl}`);
    console.log('└─────────────────────────────────────────────────────────────┘');
    console.log('');
    console.log('Next steps:');
    console.log('');
    console.log('1. Add the API key to your .env file');
    console.log('2. Run: npm run api');
    console.log('3. The agent will auto-create the project on first heartbeat');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Registration failed:', error);
    console.error('');
    console.error('Common issues:');
    console.error('- Rate limited (too many registration attempts)');
    console.error('- Name already taken');
    console.error('- Hackathon not active');
    console.error('');
    process.exit(1);
  }
}

main();
