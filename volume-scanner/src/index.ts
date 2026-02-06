// Volume Scanner Module - Main Entry Point
// Detects volume spikes on Solana tokens and sends Telegram alerts

export * from './types.js';
export * from './tokens.js';
export * from './dexscreener.js';
export * from './detector.js';
export * from './telegram.js';
export * from './storage.js';
export { VolumeScanner, getVolumeScanner } from './scanner.js';

// Default export is the scanner class
export { default } from './scanner.js';

// CLI Entry Point
if (import.meta.url === `file://${process.argv[1]}`) {
  import('./scanner.js').then(async ({ VolumeScanner }) => {
    console.log('╔══════════════════════════════════════════╗');
    console.log('║        Volume Spike Scanner              ║');
    console.log('║     "Catch the wave before it breaks"    ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
    
    const scanner = new VolumeScanner();
    await scanner.initialize();
    
    // Run a single scan for demo
    console.log('\n[DEMO] Running single scan...\n');
    const result = await scanner.scan();
    
    console.log('\n=== SCAN RESULTS ===');
    console.log(`Tokens scanned: ${result.tokensScanned}`);
    console.log(`Spikes detected: ${result.spikesDetected}`);
    console.log(`Alerts sent: ${result.alertsSent}`);
    
    if (result.spikes.length > 0) {
      console.log('\nSpikes:');
      for (const spike of result.spikes) {
        console.log(`  - ${spike.token.symbol}: ${spike.volumeSpikeMultiple.toFixed(1)}x volume, ${spike.priceChange1h.toFixed(2)}% price (${spike.severity})`);
      }
    }
    
    console.log('\nTo run continuously, use the API server or call scanner.start()');
  }).catch(console.error);
}
