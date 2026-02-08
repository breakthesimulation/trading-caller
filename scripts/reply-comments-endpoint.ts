#!/usr/bin/env tsx
/**
 * Reply to forum comments on our posts - for API endpoint
 */

import hackathon from '../agent/hackathon.js';
import brain from '../agent/brain.js';

export async function replyToAllComments() {
  console.log('[Reply] Checking for comments on our posts...');
  
  try {
    // Get our posts
    const { posts } = await hackathon.getMyForumPosts({ limit: 10 });
    console.log(`[Reply] Found ${posts.length} of our posts`);
    
    let totalReplies = 0;
    
    for (const post of posts) {
      console.log(`[Reply] Checking post: "${post.title}"`);
      console.log(`[Reply]    Comments: ${post.commentCount}`);
      
      if (post.commentCount === 0) {
        console.log('[Reply]    No comments, skipping');
        continue;
      }
      
      // Get comments on this post
      const { comments } = await hackathon.getForumComments(post.id, {
        sort: 'new',
        limit: 20
      });
      
      console.log(`[Reply]    Found ${comments.length} comments`);
      
      for (const comment of comments) {
        // Skip our own comments
        if (comment.agentName === 'trading-caller') {
          console.log(`[Reply]    Skipping our own comment`);
          continue;
        }
        
        console.log(`[Reply]    Comment from ${comment.agentName}:`);
        console.log(`[Reply]       "${comment.body.substring(0, 100)}..."`);
        
        // Check if we've already replied to this comment
        const { comments: existingReplies } = await hackathon.getForumComments(post.id);
        const alreadyReplied = existingReplies.some(
          c => c.agentName === 'trading-caller' && c.createdAt > comment.createdAt
        );
        
        if (alreadyReplied) {
          console.log(`[Reply]    Already replied to this comment`);
          continue;
        }
        
        // Generate a reply using AI
        console.log(`[Reply]    Generating AI reply...`);
        const reply = await brain.generateForumReply({
          postId: post.id,
          postTitle: post.title,
          postBody: post.body,
          commentBody: comment.body,
          commentAuthor: comment.agentName,
          ourProject: 'Trading Caller - AI trading signals for Solana',
        });
        
        // Post the reply
        console.log(`[Reply]    Posting reply...`);
        await hackathon.createForumComment(post.id, reply.body);
        console.log(`[Reply]    Replied successfully!`);
        totalReplies++;
        
        // Don't spam - wait a bit between replies
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log(`[Reply] Done! Replied to ${totalReplies} comments`);
    
    return { success: true, totalReplies, postsChecked: posts.length };
    
  } catch (error) {
    console.error('[Reply] Error:', error);
    throw error;
  }
}

export default { replyToAllComments };
