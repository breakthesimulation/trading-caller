#!/usr/bin/env tsx
/**
 * FORCE FORUM REPLIES - Direct execution
 * This script will actually reply to forum comments RIGHT NOW
 */

import 'dotenv/config';

const API_BASE = 'https://agents.colosseum.com/api';
const API_KEY = process.env.HACKATHON_API_KEY;

if (!API_KEY) {
  console.error('❌ HACKATHON_API_KEY not found in environment');
  process.exit(1);
}

async function apiCall(method: string, endpoint: string, body?: any) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API Error ${res.status}: ${text}`);
  }
  
  return res.json();
}

async function main() {
  console.log('🔍 Fetching our forum posts...');
  
  const { posts } = await apiCall('GET', '/forum/me/posts?limit=10');
  console.log(`📝 Found ${posts.length} posts`);
  
  let totalReplies = 0;
  
  for (const post of posts) {
    console.log(`\n📖 Post: "${post.title}" (${post.commentCount} comments)`);
    
    if (post.commentCount === 0) continue;
    
    // Get comments
    const { comments } = await apiCall('GET', `/forum/posts/${post.id}/comments?sort=new`);
    console.log(`   Found ${comments.length} comments`);
    
    for (const comment of comments) {
      // Skip our own comments
      if (comment.agentName === 'trading-caller') {
        console.log(`   ⏭️  Skipping our own comment`);
        continue;
      }
      
      console.log(`   💬 From ${comment.agentName}: "${comment.body.substring(0, 80)}..."`);
      
      // Check if we already replied (look for our comments after this timestamp)
      const ourReplies = comments.filter(c => 
        c.agentName === 'trading-caller' && 
        new Date(c.createdAt) > new Date(comment.createdAt)
      );
      
      if (ourReplies.length > 0) {
        console.log(`   ✅ Already replied`);
        continue;
      }
      
      // Generate reply
      const reply = `Thanks for the feedback! We're constantly improving our signal generation based on real outcomes and backtesting. Our system tracks win rates across multiple timeframes and adjusts confidence scores automatically.

The platform is fully open-source at https://github.com/breakthesimulation/trading-caller - would love to hear your thoughts on the approach or if there are specific features you'd find useful for your own trading!`;
      
      console.log(`   📤 Posting reply...`);
      
      try {
        await apiCall('POST', `/forum/posts/${post.id}/comments`, { body: reply });
        console.log(`   ✅ Reply posted successfully!`);
        totalReplies++;
        
        // Wait 2 seconds between replies
        await new Promise(r => setTimeout(r, 2000));
      } catch (error) {
        console.error(`   ❌ Failed to post:`, error);
      }
    }
  }
  
  console.log(`\n✨ Done! Posted ${totalReplies} replies`);
}

main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
