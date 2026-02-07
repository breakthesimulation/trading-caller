#!/usr/bin/env node
/**
 * Test script to verify DEX Screener links are correct
 * Run with: node test-dex-links.js
 */

const API_URL = 'https://web-production-5e86c.up.railway.app/signals/latest';

async function testDexLinks() {
  console.log('🔍 Testing DEX Screener Links...\n');
  
  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    
    if (!data.signals || data.signals.length === 0) {
      console.log('⚠️  No signals returned from API');
      return;
    }
    
    console.log(`✅ Found ${data.signals.length} signals\n`);
    
    let errors = 0;
    const USDC_ADDRESS = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const USDT_ADDRESS = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
    
    data.signals.forEach((signal, idx) => {
      const symbol = signal.token?.symbol || 'UNKNOWN';
      const address = signal.token?.address || 'MISSING';
      const dexUrl = `https://dexscreener.com/solana/${address}`;
      
      console.log(`Signal #${idx + 1}: ${symbol}`);
      console.log(`  Address: ${address}`);
      
      // Check if address is USDC or USDT (the bug)
      if (address === USDC_ADDRESS && symbol !== 'USDC') {
        console.log(`  ❌ ERROR: ${symbol} has USDC address! (BUG DETECTED)`);
        errors++;
      } else if (address === USDT_ADDRESS && symbol !== 'USDT') {
        console.log(`  ❌ ERROR: ${symbol} has USDT address! (BUG DETECTED)`);
        errors++;
      } else {
        console.log(`  ✅ Correct address`);
      }
      
      console.log(`  Link: ${dexUrl}\n`);
    });
    
    console.log('\n' + '='.repeat(50));
    if (errors === 0) {
      console.log('✅ ALL TESTS PASSED - DEX Links are correct!');
    } else {
      console.log(`❌ ${errors} ERROR(S) FOUND - DEX Links need fixing!`);
    }
    console.log('='.repeat(50) + '\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run test
testDexLinks();
