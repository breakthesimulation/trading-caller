#!/usr/bin/env tsx
/**
 * Hackathon Status Script
 * 
 * Check the current status of the Trading Caller agent in the hackathon.
 * 
 * Usage:
 *   npm run hackathon:status
 *   # or
 *   npx tsx scripts/hackathon-status.ts
 */

import 'dotenv/config';
import hackathon from '../agent/hackathon.js';
import { db } from '../db/index.js';
import tracker from '../learning/tracker.js';

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║        Trading Caller - Hackathon Status                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // Check API key
  if (!process.env.HACKATHON_API_KEY) {
    console.log('❌ HACKATHON_API_KEY not set');
    console.log('');
    console.log('Run: npm run hackathon:register');
    console.log('');
    process.exit(1);
  }

  try {
    // Get agent status from API
    console.log('Fetching status from Colosseum API...');
    console.log('');
    
    const status = await hackathon.getStatus();
    
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│ AGENT                                                       │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log(`│ Name: ${status.agent.name}`);
    console.log(`│ Status: ${status.agent.status}`);
    console.log('└─────────────────────────────────────────────────────────────┘');
    console.log('');

    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│ HACKATHON                                                   │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log(`│ Name: ${status.hackathon.name}`);
    console.log(`│ Status: ${status.hackathon.status}`);
    console.log(`│ Ends: ${status.hackathon.endsAt}`);
    console.log('└─────────────────────────────────────────────────────────────┘');
    console.log('');

    if (status.project) {
      console.log('┌─────────────────────────────────────────────────────────────┐');
      console.log('│ PROJECT                                                     │');
      console.log('├─────────────────────────────────────────────────────────────┤');
      console.log(`│ Name: ${status.project.name}`);
      console.log(`│ Status: ${status.project.status}`);
      console.log('└─────────────────────────────────────────────────────────────┘');
      console.log('');
    } else {
      console.log('⚠️  No project created yet');
      console.log('');
    }

    if (status.team) {
      console.log('┌─────────────────────────────────────────────────────────────┐');
      console.log('│ TEAM                                                        │');
      console.log('├─────────────────────────────────────────────────────────────┤');
      console.log(`│ Name: ${status.team.name}`);
      console.log(`│ Members: ${status.team.memberCount}`);
      console.log('└─────────────────────────────────────────────────────────────┘');
      console.log('');
    }

    if (status.engagement) {
      console.log('┌─────────────────────────────────────────────────────────────┐');
      console.log('│ ENGAGEMENT                                                  │');
      console.log('├─────────────────────────────────────────────────────────────┤');
      console.log(`│ Forum Posts: ${status.engagement.forumPosts}`);
      console.log(`│ Forum Comments: ${status.engagement.forumComments}`);
      console.log(`│ Project Votes: ${status.engagement.projectVotes}`);
      console.log('└─────────────────────────────────────────────────────────────┘');
      console.log('');
    }

    // Local performance stats
    const stats = tracker.getPerformanceStats();
    if (stats.total > 0) {
      console.log('┌─────────────────────────────────────────────────────────────┐');
      console.log('│ SIGNAL PERFORMANCE                                          │');
      console.log('├─────────────────────────────────────────────────────────────┤');
      console.log(`│ Total Signals: ${stats.total}`);
      console.log(`│ Wins: ${stats.wins} | Losses: ${stats.losses} | Neutral: ${stats.neutral}`);
      console.log(`│ Win Rate: ${stats.winRate.toFixed(1)}%`);
      console.log(`│ Avg PnL: ${stats.avgPnl >= 0 ? '+' : ''}${stats.avgPnl.toFixed(2)}%`);
      console.log(`│ Pending: ${stats.pending}`);
      console.log('└─────────────────────────────────────────────────────────────┘');
      console.log('');
    }

    // Next steps
    if (status.nextSteps && status.nextSteps.length > 0) {
      console.log('┌─────────────────────────────────────────────────────────────┐');
      console.log('│ NEXT STEPS                                                  │');
      console.log('├─────────────────────────────────────────────────────────────┤');
      status.nextSteps.forEach((step, i) => {
        console.log(`│ ${i + 1}. ${step}`);
      });
      console.log('└─────────────────────────────────────────────────────────────┘');
      console.log('');
    }

  } catch (error) {
    console.error('❌ Failed to get status:', error);
    process.exit(1);
  }
}

main();
