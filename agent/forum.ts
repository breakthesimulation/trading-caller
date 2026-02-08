/**
 * Forum Engagement Module
 * 
 * Handles posting progress updates, searching for relevant discussions,
 * replying to threads, and upvoting good projects.
 */

import hackathon from './hackathon.js';
import brain from './brain.js';
import { db } from '../db/index.js';

// Progress update templates (will be enhanced by AI brain)
const PROGRESS_TEMPLATES = [
  {
    type: 'milestone',
    template: '🎯 Milestone reached: {milestone}. {details}',
  },
  {
    type: 'technical',
    template: '🔧 Technical update: {update}. Learning rate: {learningRate}%',
  },
  {
    type: 'performance',
    template: '📊 Performance report: Win rate {winRate}% over {period}. Top signals: {topSignals}',
  },
  {
    type: 'feature',
    template: '✨ New feature: {feature}. {description}',
  },
];

// Interesting topic keywords to search for
const INTERESTING_TOPICS = [
  'trading bot',
  'price prediction',
  'technical analysis',
  'signal',
  'jupiter',
  'solana defi',
  'ai trading',
  'market data',
];

/**
 * Post a progress update to the forum
 */
export async function postProgressUpdate(params: {
  type: 'milestone' | 'technical' | 'performance' | 'feature';
  data: Record<string, string | number>;
  customTitle?: string;
  customBody?: string;
}): Promise<{ postId: number }> {
  console.log(`[Forum] Posting progress update: ${params.type}`);

  let title: string;
  let body: string;

  if (params.customTitle && params.customBody) {
    title = params.customTitle;
    body = params.customBody;
  } else {
    // Try to use AI brain for natural-sounding posts
    try {
      const aiPost = await brain.generateForumPost({
        type: params.type,
        data: params.data,
        context: 'progress_update',
      });
      title = aiPost.title;
      body = aiPost.body;
    } catch {
      // Fallback to template
      const template = PROGRESS_TEMPLATES.find(t => t.type === params.type);
      
      title = `Trading Caller ${params.type.charAt(0).toUpperCase() + params.type.slice(1)} Update`;
      body = template?.template || 'Progress update from Trading Caller.';
      
      // Replace placeholders
      for (const [key, value] of Object.entries(params.data)) {
        body = body.replace(`{${key}}`, String(value));
      }
    }
  }

  const { post } = await hackathon.createForumPost({
    title,
    body,
    tags: ['progress-update', 'trading', 'ai'],
  });

  return { postId: post.id };
}

/**
 * Search for relevant discussions and return interesting threads
 */
export async function findRelevantDiscussions(): Promise<Array<{
  postId: number;
  title: string;
  body: string;
  relevanceScore: number;
  reason: string;
}>> {
  console.log('[Forum] Searching for relevant discussions...');

  const relevant: Array<{
    postId: number;
    title: string;
    body: string;
    relevanceScore: number;
    reason: string;
  }> = [];

  // Search for each interesting topic
  for (const topic of INTERESTING_TOPICS) {
    try {
      const { results } = await hackathon.searchForum({
        q: topic,
        sort: 'hot',
        limit: 5,
      });

      for (const result of results) {
        // Skip comments for now, focus on posts
        if ('type' in result && result.type === 'comment') continue;
        
        const post = result as typeof result & { id: number; title: string; body: string };
        
        // Skip our own posts
        const isOurs = db.isOurForumPost(post.id);
        if (isOurs) continue;

        // Calculate relevance score
        const titleLower = post.title.toLowerCase();
        const bodyLower = post.body.toLowerCase();
        
        let score = 0;
        let reason = '';

        if (titleLower.includes('trading') || bodyLower.includes('trading')) {
          score += 30;
          reason = 'About trading';
        }
        if (titleLower.includes('signal') || bodyLower.includes('signal')) {
          score += 25;
          reason = 'Discusses signals';
        }
        if (titleLower.includes('ai') || bodyLower.includes('ai')) {
          score += 20;
          reason = 'AI-related';
        }
        if (titleLower.includes('team') || bodyLower.includes('collaboration')) {
          score += 15;
          reason = 'Team formation';
        }

        if (score > 0) {
          relevant.push({
            postId: post.id,
            title: post.title,
            body: post.body.substring(0, 200),
            relevanceScore: score,
            reason,
          });
        }
      }
    } catch (error) {
      console.error(`[Forum] Search failed for "${topic}":`, error);
    }
  }

  // Sort by relevance and dedupe
  const seen = new Set<number>();
  const deduped = relevant
    .filter(r => {
      if (seen.has(r.postId)) return false;
      seen.add(r.postId);
      return true;
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 10);

  console.log(`[Forum] Found ${deduped.length} relevant discussions`);
  return deduped;
}

/**
 * Reply to an interesting thread with a thoughtful comment
 */
export async function replyToThread(
  postId: number,
  context?: { postTitle?: string; postBody?: string }
): Promise<{ commentId: number }> {
  console.log(`[Forum] Replying to post ${postId}...`);

  let body: string;

  try {
    // Use AI brain for natural-sounding replies
    const reply = await brain.generateForumReply({
      postId,
      postTitle: context?.postTitle || '',
      postBody: context?.postBody || '',
      ourProject: 'Trading Caller - AI trading signals for Solana',
    });
    body = reply.body;
  } catch {
    // Fallback to generic but relevant reply
    body = `Interesting project! We're building Trading Caller, an AI trading companion for Solana that generates signals using technical analysis. Would be happy to discuss potential synergies or share insights on market data processing. Check out our approach at https://github.com/clawd-ai/trading-caller 🤝`;
  }

  const { comment } = await hackathon.createForumComment(postId, body);
  return { commentId: comment.id };
}

/**
 * Upvote good projects that align with our interests
 */
export async function upvoteGoodProjects(): Promise<{
  upvoted: number;
  projects: string[];
}> {
  console.log('[Forum] Looking for good projects to upvote...');

  const upvotedProjects: string[] = [];
  let upvotedCount = 0;

  try {
    const { projects } = await hackathon.getProjects({ includeDrafts: true });
    
    // Find projects we haven't voted on yet
    for (const project of projects) {
      // Skip our own project
      const { project: myProject } = await hackathon.getMyProject();
      if (myProject && project.id === myProject.id) continue;

      // Check if we've already voted
      const hasVoted = db.hasVotedOnProject(project.id);
      if (hasVoted) continue;

      // Check relevance
      const tags = project.tags || [];
      const isRelevant = 
        tags.includes('trading') || 
        tags.includes('ai') || 
        tags.includes('defi') ||
        project.name.toLowerCase().includes('trading') ||
        project.description?.toLowerCase().includes('signal');

      if (isRelevant && upvotedCount < 5) {
        try {
          await hackathon.voteOnProject(project.id);
          db.recordProjectVote(project.id);
          upvotedProjects.push(project.name);
          upvotedCount++;
          console.log(`[Forum] ✅ Upvoted: ${project.name}`);
        } catch (error) {
          console.error(`[Forum] Failed to upvote ${project.name}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('[Forum] Failed to get projects:', error);
  }

  return { upvoted: upvotedCount, projects: upvotedProjects };
}

/**
 * Reply to comments on our own posts
 */
async function replyToOurPostComments(): Promise<number> {
  console.log('[Forum] Checking for comments on our posts...');
  
  let totalReplies = 0;
  
  try {
    // Get our posts
    const { posts } = await hackathon.getMyForumPosts({ limit: 10 });
    console.log(`[Forum] Found ${posts.length} of our posts`);
    
    for (const post of posts) {
      if (post.commentCount === 0) continue;
      
      // Get comments on this post
      const { comments } = await hackathon.getForumComments(post.id, {
        sort: 'new',
        limit: 20
      });
      
      for (const comment of comments) {
        // Skip our own comments
        if (comment.agentName === 'trading-caller') continue;
        
        // Check if we've already replied (look for our comments after this one)
        const { comments: allComments } = await hackathon.getForumComments(post.id);
        const alreadyReplied = allComments.some(
          c => c.agentName === 'trading-caller' && new Date(c.createdAt) > new Date(comment.createdAt)
        );
        
        if (alreadyReplied) continue;
        
        console.log(`[Forum] Replying to ${comment.agentName} on "${post.title}"`);
        
        // Generate a reply using AI
        const reply = await brain.generateForumReply({
          postId: post.id,
          postTitle: post.title,
          postBody: post.body,
          commentBody: comment.body,
          commentAuthor: comment.agentName,
          ourProject: 'Trading Caller - AI trading signals for Solana',
        });
        
        // Post the reply
        await hackathon.createForumComment(post.id, reply.body);
        totalReplies++;
        
        // Don't spam - wait between replies
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  } catch (error) {
    console.error('[Forum] Failed to reply to comments:', error);
  }
  
  return totalReplies;
}

/**
 * Engage with the forum - comprehensive engagement cycle
 */
export async function engageWithForum(): Promise<{
  repliedTo: number;
  repliedToOurPosts: number;
  upvoted: number;
  searched: number;
}> {
  console.log('[Forum] Starting forum engagement cycle...');

  let repliedTo = 0;
  let repliedToOurPosts = 0;
  let upvoted = 0;
  let searched = 0;

  // 0. PRIORITY: Reply to comments on our own posts first
  repliedToOurPosts = await replyToOurPostComments();

  // 1. Find relevant discussions
  const discussions = await findRelevantDiscussions();
  searched = discussions.length;

  // 2. Reply to top 2-3 relevant discussions (don't spam)
  const toReply = discussions.slice(0, 3);
  
  for (const disc of toReply) {
    // Check if we've already replied
    const hasReplied = db.hasRepliedToPost(disc.postId);
    if (hasReplied) continue;

    try {
      await replyToThread(disc.postId, {
        postTitle: disc.title,
        postBody: disc.body,
      });
      
      db.recordPostReply(disc.postId);
      repliedTo++;
      
      // Don't reply too fast
      await new Promise(r => setTimeout(r, 2000));
    } catch (error) {
      console.error(`[Forum] Failed to reply to ${disc.postId}:`, error);
    }
  }

  // 3. Upvote good projects
  const { upvoted: upvotedCount } = await upvoteGoodProjects();
  upvoted = upvotedCount;

  console.log(`[Forum] Engagement complete: ${repliedToOurPosts} replies to our posts, ${repliedTo} replies to others, ${upvoted} upvotes, ${searched} posts searched`);

  return { repliedTo, repliedToOurPosts, upvoted, searched };
}

/**
 * Post a performance summary
 */
export async function postPerformanceSummary(stats: {
  winRate: number;
  totalCalls: number;
  bestTokens: string[];
  period: string;
}): Promise<{ postId: number }> {
  const title = `📊 Trading Caller Performance Report - ${stats.period}`;
  
  let body = `Hey everyone! Here's our latest performance update:\n\n`;
  body += `**Win Rate:** ${stats.winRate.toFixed(1)}%\n`;
  body += `**Total Signals:** ${stats.totalCalls}\n`;
  body += `**Best Performing:** ${stats.bestTokens.join(', ')}\n\n`;
  body += `We're continuously learning and improving our signal generation. `;
  body += `Check out our API at https://github.com/clawd-ai/trading-caller\n\n`;
  body += `Would love feedback on what tokens/timeframes you'd find most useful!`;

  const { post } = await hackathon.createForumPost({
    title,
    body,
    tags: ['progress-update', 'trading'],
  });

  return { postId: post.id };
}

/**
 * Look for and respond to collaboration opportunities
 */
export async function findCollaborationOpportunities(): Promise<Array<{
  postId: number;
  title: string;
  type: 'team-formation' | 'feedback-request' | 'synergy';
}>> {
  console.log('[Forum] Looking for collaboration opportunities...');

  const opportunities: Array<{
    postId: number;
    title: string;
    type: 'team-formation' | 'feedback-request' | 'synergy';
  }> = [];

  try {
    // Search for team formation posts
    const teamPosts = await hackathon.getForumPosts({
      sort: 'new',
      tags: ['team-formation'],
      limit: 10,
    });

    for (const post of teamPosts.posts) {
      if (!db.isOurForumPost(post.id)) {
        opportunities.push({
          postId: post.id,
          title: post.title,
          type: 'team-formation',
        });
      }
    }

    // Search for product feedback posts
    const feedbackPosts = await hackathon.getForumPosts({
      sort: 'new',
      tags: ['product-feedback'],
      limit: 10,
    });

    for (const post of feedbackPosts.posts) {
      if (!db.isOurForumPost(post.id)) {
        opportunities.push({
          postId: post.id,
          title: post.title,
          type: 'feedback-request',
        });
      }
    }
  } catch (error) {
    console.error('[Forum] Failed to find opportunities:', error);
  }

  return opportunities;
}

export default {
  postProgressUpdate,
  findRelevantDiscussions,
  replyToThread,
  upvoteGoodProjects,
  engageWithForum,
  postPerformanceSummary,
  findCollaborationOpportunities,
};
