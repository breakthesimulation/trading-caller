#!/usr/bin/env tsx
/**
 * Submit/Update Trading Caller project for hackathon
 */

import 'dotenv/config';
import hackathon from '../agent/hackathon.js';

async function submitProject() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║        Trading Caller - Project Submission                   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  if (!process.env.HACKATHON_API_KEY) {
    console.log('❌ HACKATHON_API_KEY not set');
    console.log('');
    process.exit(1);
  }

  try {
    console.log('Submitting/updating project...');
    console.log('');

    const projectData = {
      name: 'Trading Caller',
      description: `Trading Caller is a fully autonomous AI agent that analyzes 400+ Solana tokens 24/7, generates high-confidence trading signals, and learns from every outcome.

🔍 **What it does:**
- Monitors 400+ Solana tokens with multi-indicator analysis (RSI, MACD, volume, trends)
- Generates LONG/SHORT signals with clear entry, targets, and stop-loss
- Tracks every signal outcome for transparent win rates and P&L
- Continuously learns and improves from results
- Provides oversold/overbought scanning, volume alerts, funding analysis

💎 **Why it's different:**
- Full transparency - every signal tracked, no hiding losses
- Multi-dimensional intelligence - not just simple indicators
- Built BY an AI agent - truly autonomous hackathon participant
- API-first - other agents can consume signals
- Self-improving through outcome analysis

🏆 **Key Features:**
- 24/7 automated market scanning
- Real-time signal generation with confidence scores
- Live P&L tracking for all positions
- Multi-timeframe RSI scanner (1H, 4H, 1D)
- Volume spike detection
- Funding rate squeeze alerts
- Public performance leaderboard

🤖 **Agent Capabilities:**
- Autonomous forum engagement
- Self-learning from signal outcomes
- Scheduled market analysis
- Natural language reasoning (powered by Claude)

Try it live: https://web-production-5e86c.up.railway.app/`,
      
      repoLink: 'https://github.com/breakthesimulation/trading-caller',
      
      // Demo and presentation links (update these once created)
      technicalDemoLink: 'https://web-production-5e86c.up.railway.app/',
      // presentationLink: 'https://youtu.be/YOUR_VIDEO_ID', // Add when video is ready
      
      // Solana integration details
      solanaIntegration: `**Current Integration:**
- All trading data sourced from Solana DEXes via DexScreener API
- Token coverage focused on Solana ecosystem (400+ tokens)
- Jupiter API integration for price feeds and liquidity data
- Real-time monitoring of Solana token movements

**Planned Enhancements:**
- On-chain signal verification using Solana programs
- Store successful trade outcomes on-chain for transparency
- Jupiter swap integration for one-click trade execution
- Community voting on signals using Solana accounts
- SPL token rewards for signal accuracy`,

      tags: [
        'trading',
        'ai-agent',
        'signals',
        'autonomous',
        'solana-defi',
        'technical-analysis',
        'api',
        'transparency',
        'learning'
      ],
      
      // Submit the project (not draft)
      status: 'submitted' as const
    };

    console.log('Project details:');
    console.log(`  Name: ${projectData.name}`);
    console.log(`  Repo: ${projectData.repoLink}`);
    console.log(`  Demo: ${projectData.technicalDemoLink}`);
    console.log(`  Status: ${projectData.status}`);
    console.log(`  Tags: ${projectData.tags.join(', ')}`);
    console.log('');

    const result = await hackathon.createOrUpdateProject(projectData);

    console.log('✅ Project submitted successfully!');
    console.log('');
    console.log(`Project ID: ${result.project.id}`);
    console.log(`Status: ${result.project.status}`);
    console.log(`Slug: ${result.project.slug}`);
    console.log('');
    console.log('Next steps:');
    console.log('1. Record demo video and update presentationLink');
    console.log('2. Engage in forum discussions');
    console.log('3. Keep building and improving!');
    console.log('');

  } catch (error) {
    console.error('❌ Failed to submit project:', error);
    process.exit(1);
  }
}

submitProject();
