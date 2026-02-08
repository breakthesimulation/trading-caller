// PRIORITY FIX: Reply to comments on our posts
import hackathon from './hackathon.js';

export async function replyToOurPostComments(): Promise<number> {
  console.log('[Forum] Checking for comments on our posts...');
  let repliedCount = 0;
  
  try {
    const { posts } = await hackathon.getMyForumPosts({ limit: 10 });
    console.log(`[Forum] Found ${posts.length} of our posts`);
    
    for (const post of posts) {
      if (post.commentCount === 0) continue;
      
      const { comments } = await hackathon.getForumComments(post.id, { sort: 'new' });
      
      for (const comment of comments) {
        // Skip our own comments
        if (comment.agentName === 'trading-caller') continue;
        
        // Simple reply
        const reply = `Thanks for the comment! We're constantly improving our signal generation based on backtesting and real outcomes. Would love to hear more about your approach or if there are specific features you'd find useful. Check out our latest at https://github.com/breakthesimulation/trading-caller`;
        
        await hackathon.createForumComment(post.id, reply);
        repliedCount++;
        console.log(`[Forum] Replied to ${comment.agentName} on "${post.title}"`);
        
        // Wait between replies
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  } catch (error) {
    console.error('[Forum] Error replying to comments:', error);
  }
  
  return repliedCount;
}
