#!/usr/bin/env node
/**
 * Temporary script to check forum activity via Railway deployment
 */

const RAILWAY_BASE = 'https://web-production-5e86c.up.railway.app';

async function checkForumActivity() {
  console.log('🔍 Checking forum activity via Railway...\n');
  
  try {
    // Check hackathon status
    const statusRes = await fetch(`${RAILWAY_BASE}/hackathon/status`);
    const status = await statusRes.json();
    
    console.log('📊 Current Status:');
    console.log(`   Forum Posts: ${status.engagement?.forumPostCount || 0}`);
    console.log(`   Replies on Your Posts: ${status.engagement?.repliesOnYourPosts || 0}`);
    console.log(`   Project Status: ${status.engagement?.projectStatus || 'unknown'}`);
    console.log();
    
    // Trigger forum engagement
    console.log('🤖 Triggering forum engagement...');
    const engageRes = await fetch(`${RAILWAY_BASE}/scheduler/trigger/forumEngagement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const engageResult = await engageRes.json();
    console.log(`   Result: ${JSON.stringify(engageResult)}`);
    console.log();
    
    // Wait a bit for it to process
    console.log('⏳ Waiting 30 seconds for processing...');
    await new Promise(r => setTimeout(r, 30000));
    
    // Check status again
    const statusRes2 = await fetch(`${RAILWAY_BASE}/hackathon/status`);
    const status2 = await statusRes2.json();
    
    console.log('📊 Updated Status:');
    console.log(`   Forum Posts: ${status2.engagement?.forumPostCount || 0}`);
    console.log(`   Replies on Your Posts: ${status2.engagement?.repliesOnYourPosts || 0}`);
    console.log(`   Project Status: ${status2.engagement?.projectStatus || 'unknown'}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkForumActivity();
