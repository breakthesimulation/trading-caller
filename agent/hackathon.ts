/**
 * Hackathon Agent - Core API Integration
 * 
 * Handles all communication with the Colosseum Agent Hackathon API.
 * API Base: https://agents.colosseum.com/api
 */

import { db } from '../db/index.js';

const API_BASE = 'https://agents.colosseum.com/api';

interface AgentRegistration {
  agent: {
    id: number;
    hackathonId: number;
    name: string;
    status: string;
    createdAt: string;
  };
  apiKey: string;
  claimCode: string;
  verificationCode: string;
  claimUrl: string;
  skillUrl: string;
  heartbeatUrl: string;
}

interface AgentStatus {
  agent: {
    id: number;
    name: string;
    status: string;
  };
  hackathon: {
    id: number;
    name: string;
    status: string;
    startsAt: string;
    endsAt: string;
  };
  project: {
    id?: number;
    name?: string;
    status?: string;
  } | null;
  team: {
    id?: number;
    name?: string;
    memberCount?: number;
  } | null;
  engagement?: {
    forumPosts: number;
    forumComments: number;
    projectVotes: number;
  };
  nextSteps?: string[];
}

interface Project {
  id: number;
  hackathonId: number;
  name: string;
  slug: string;
  description: string;
  repoLink: string;
  solanaIntegration?: string;
  technicalDemoLink?: string;
  presentationLink?: string;
  tags: string[];
  status: 'draft' | 'submitted';
  humanUpvotes: number;
  agentUpvotes: number;
}

interface ForumPost {
  id: number;
  agentId: number;
  agentName: string;
  title: string;
  body: string;
  tags?: string[];
  upvotes: number;
  downvotes: number;
  score: number;
  commentCount: number;
  isDeleted: boolean;
  createdAt: string;
  editedAt: string | null;
}

interface ForumComment {
  id: number;
  postId: number;
  agentId: number;
  agentName: string;
  body: string;
  upvotes: number;
  downvotes: number;
  score: number;
  isDeleted: boolean;
  createdAt: string;
  editedAt: string | null;
}

interface APIError {
  error: string;
  message?: string;
  statusCode?: number;
}

/**
 * Get the hackathon API key from environment
 */
function getApiKey(): string {
  const apiKey = process.env.HACKATHON_API_KEY;
  if (!apiKey) {
    throw new Error('HACKATHON_API_KEY not set. Run registerAgent() first or set it manually.');
  }
  return apiKey;
}

/**
 * Make an authenticated API request
 */
async function apiRequest<T>(
  method: string,
  endpoint: string,
  body?: Record<string, unknown>,
  authenticated: boolean = true
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (authenticated) {
    headers['Authorization'] = `Bearer ${getApiKey()}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    const error = data as APIError;
    throw new Error(`API Error ${response.status}: ${error.error || error.message || 'Unknown error'}`);
  }

  return data as T;
}

// ============ AGENT REGISTRATION ============

/**
 * Register a new agent with the hackathon.
 * WARNING: Only call this once! The API key is shown exactly once.
 */
export async function registerAgent(name: string): Promise<AgentRegistration> {
  console.log(`[Hackathon] Registering agent: ${name}`);
  
  const result = await apiRequest<AgentRegistration>(
    'POST',
    '/agents',
    { name },
    false // No auth for registration
  );

  // Store the claim code securely in the database
  db.setConfig('hackathon_claim_code', result.claimCode);
  db.setConfig('hackathon_verification_code', result.verificationCode);
  db.setConfig('hackathon_agent_id', String(result.agent.id));
  db.setConfig('hackathon_agent_name', result.agent.name);

  console.log(`[Hackathon] ✅ Agent registered successfully!`);
  console.log(`[Hackathon] Agent ID: ${result.agent.id}`);
  console.log(`[Hackathon] Claim URL: ${result.claimUrl}`);
  console.log(`[Hackathon] ⚠️  SAVE YOUR API KEY - it won't be shown again!`);
  
  // DO NOT log the API key - user must set it in env
  return result;
}

/**
 * Get current agent status, hackathon info, and next steps
 */
export async function getStatus(): Promise<AgentStatus> {
  return apiRequest<AgentStatus>('GET', '/agents/status');
}

// ============ PROJECT MANAGEMENT ============

/**
 * Create a new project (starts in draft status)
 */
export async function createProject(params: {
  name: string;
  description: string;
  repoLink: string;
  solanaIntegration?: string;
  technicalDemoLink?: string;
  presentationLink?: string;
  tags?: string[];
}): Promise<{ project: Project }> {
  console.log(`[Hackathon] Creating project: ${params.name}`);
  
  const result = await apiRequest<{ project: Project }>('POST', '/my-project', params);
  
  db.setConfig('hackathon_project_id', String(result.project.id));
  db.setConfig('hackathon_project_slug', result.project.slug);
  
  console.log(`[Hackathon] ✅ Project created: ${result.project.slug}`);
  return result;
}

/**
 * Update project (only while in draft status)
 */
export async function updateProject(params: {
  name?: string;
  description?: string;
  repoLink?: string;
  solanaIntegration?: string;
  technicalDemoLink?: string;
  presentationLink?: string;
  tags?: string[];
}): Promise<{ project: Project }> {
  console.log(`[Hackathon] Updating project...`);
  return apiRequest<{ project: Project }>('PUT', '/my-project', params);
}

/**
 * Get my current project
 */
export async function getMyProject(): Promise<{ project: Project | null }> {
  try {
    return await apiRequest<{ project: Project }>('GET', '/my-project');
  } catch (error) {
    // 404 means no project yet
    if (error instanceof Error && error.message.includes('404')) {
      return { project: null };
    }
    throw error;
  }
}

/**
 * Submit project for judging (one-way action - locks the project)
 */
export async function submitProject(): Promise<{ project: Project }> {
  console.log(`[Hackathon] ⚠️  Submitting project for judging (this is permanent!)...`);
  const result = await apiRequest<{ project: Project }>('POST', '/my-project/submit');
  console.log(`[Hackathon] ✅ Project submitted successfully!`);
  return result;
}

// ============ FORUM ============

/**
 * Create a forum post
 */
export async function createForumPost(params: {
  title: string;
  body: string;
  tags?: string[];
}): Promise<{ post: ForumPost }> {
  console.log(`[Hackathon] Creating forum post: ${params.title}`);
  
  const result = await apiRequest<{ post: ForumPost }>('POST', '/forum/posts', params);
  
  // Track the post in our database
  db.trackForumPost(result.post.id, 'post', result.post.title, result.post.body);
  
  console.log(`[Hackathon] ✅ Forum post created: ID ${result.post.id}`);
  return result;
}

/**
 * Get forum posts
 */
export async function getForumPosts(params?: {
  sort?: 'hot' | 'new' | 'top';
  tags?: string[];
  limit?: number;
  offset?: number;
}): Promise<{ posts: ForumPost[]; total: number }> {
  const queryParams = new URLSearchParams();
  
  if (params?.sort) queryParams.set('sort', params.sort);
  if (params?.limit) queryParams.set('limit', String(params.limit));
  if (params?.offset) queryParams.set('offset', String(params.offset));
  if (params?.tags) {
    params.tags.forEach(tag => queryParams.append('tags', tag));
  }

  const query = queryParams.toString();
  return apiRequest<{ posts: ForumPost[]; total: number }>(
    'GET',
    `/forum/posts${query ? `?${query}` : ''}`,
    undefined,
    false // Public endpoint
  );
}

/**
 * Get a single forum post
 */
export async function getForumPost(postId: number): Promise<{ post: ForumPost }> {
  return apiRequest<{ post: ForumPost }>('GET', `/forum/posts/${postId}`, undefined, false);
}

/**
 * Get my forum posts
 */
export async function getMyForumPosts(params?: {
  sort?: 'hot' | 'new' | 'top';
  limit?: number;
  offset?: number;
}): Promise<{ posts: ForumPost[]; total: number }> {
  const queryParams = new URLSearchParams();
  
  if (params?.sort) queryParams.set('sort', params.sort);
  if (params?.limit) queryParams.set('limit', String(params.limit));
  if (params?.offset) queryParams.set('offset', String(params.offset));

  const query = queryParams.toString();
  return apiRequest<{ posts: ForumPost[]; total: number }>(
    'GET',
    `/forum/me/posts${query ? `?${query}` : ''}`
  );
}

/**
 * Create a comment on a forum post
 */
export async function createForumComment(
  postId: number,
  body: string
): Promise<{ comment: ForumComment }> {
  console.log(`[Hackathon] Commenting on post ${postId}`);
  
  const result = await apiRequest<{ comment: ForumComment }>(
    'POST',
    `/forum/posts/${postId}/comments`,
    { body }
  );
  
  // Track the comment
  db.trackForumPost(result.comment.id, 'comment', `Re: Post ${postId}`, body);
  
  return result;
}

/**
 * Get comments on a forum post
 */
export async function getForumComments(
  postId: number,
  params?: { sort?: 'hot' | 'new' | 'top'; limit?: number; offset?: number }
): Promise<{ comments: ForumComment[]; total: number }> {
  const queryParams = new URLSearchParams();
  
  if (params?.sort) queryParams.set('sort', params.sort);
  if (params?.limit) queryParams.set('limit', String(params.limit));
  if (params?.offset) queryParams.set('offset', String(params.offset));

  const query = queryParams.toString();
  return apiRequest<{ comments: ForumComment[]; total: number }>(
    'GET',
    `/forum/posts/${postId}/comments${query ? `?${query}` : ''}`,
    undefined,
    false
  );
}

/**
 * Get my forum comments
 */
export async function getMyForumComments(params?: {
  sort?: 'hot' | 'new' | 'top';
  limit?: number;
  offset?: number;
}): Promise<{ comments: ForumComment[]; total: number }> {
  const queryParams = new URLSearchParams();
  
  if (params?.sort) queryParams.set('sort', params.sort);
  if (params?.limit) queryParams.set('limit', String(params.limit));
  if (params?.offset) queryParams.set('offset', String(params.offset));

  const query = queryParams.toString();
  return apiRequest<{ comments: ForumComment[]; total: number }>(
    'GET',
    `/forum/me/comments${query ? `?${query}` : ''}`
  );
}

/**
 * Vote on a forum post
 */
export async function voteOnPost(postId: number, value: 1 | -1): Promise<void> {
  await apiRequest('POST', `/forum/posts/${postId}/vote`, { value });
}

/**
 * Remove vote from a post
 */
export async function removePostVote(postId: number): Promise<void> {
  await apiRequest('DELETE', `/forum/posts/${postId}/vote`);
}

/**
 * Vote on a forum comment
 */
export async function voteOnComment(commentId: number, value: 1 | -1): Promise<void> {
  await apiRequest('POST', `/forum/comments/${commentId}/vote`, { value });
}

/**
 * Search forum posts and comments
 */
export async function searchForum(params: {
  q: string;
  sort?: 'hot' | 'new' | 'top';
  tags?: string[];
  limit?: number;
}): Promise<{ results: Array<ForumPost | (ForumComment & { type: string; postId: number })> }> {
  const queryParams = new URLSearchParams();
  queryParams.set('q', params.q);
  
  if (params.sort) queryParams.set('sort', params.sort);
  if (params.limit) queryParams.set('limit', String(params.limit));
  if (params.tags) {
    params.tags.forEach(tag => queryParams.append('tags', tag));
  }

  return apiRequest(
    'GET',
    `/forum/search?${queryParams.toString()}`,
    undefined,
    false
  );
}

/**
 * Edit a forum post
 */
export async function editForumPost(
  postId: number,
  params: { body?: string; tags?: string[] }
): Promise<{ post: ForumPost }> {
  return apiRequest<{ post: ForumPost }>('PATCH', `/forum/posts/${postId}`, params);
}

/**
 * Delete a forum post (soft delete)
 */
export async function deleteForumPost(postId: number): Promise<void> {
  await apiRequest('DELETE', `/forum/posts/${postId}`);
}

/**
 * Edit a forum comment
 */
export async function editForumComment(
  commentId: number,
  body: string
): Promise<{ comment: ForumComment }> {
  return apiRequest<{ comment: ForumComment }>('PATCH', `/forum/comments/${commentId}`, { body });
}

/**
 * Delete a forum comment (soft delete)
 */
export async function deleteForumComment(commentId: number): Promise<void> {
  await apiRequest('DELETE', `/forum/comments/${commentId}`);
}

// ============ PROJECTS & LEADERBOARD ============

/**
 * Vote on a project
 */
export async function voteOnProject(projectId: number): Promise<void> {
  await apiRequest('POST', `/projects/${projectId}/vote`);
}

/**
 * Remove vote from a project
 */
export async function removeProjectVote(projectId: number): Promise<void> {
  await apiRequest('DELETE', `/projects/${projectId}/vote`);
}

/**
 * Get the leaderboard
 */
export async function getLeaderboard(): Promise<{
  projects: Array<Project & { rank: number }>;
}> {
  return apiRequest('GET', '/leaderboard', undefined, false);
}

/**
 * Get submitted projects
 */
export async function getProjects(params?: {
  includeDrafts?: boolean;
}): Promise<{ projects: Project[] }> {
  const query = params?.includeDrafts ? '?includeDrafts=true' : '';
  return apiRequest<{ projects: Project[] }>('GET', `/projects${query}`, undefined, false);
}

/**
 * Get a project by slug
 */
export async function getProject(slug: string): Promise<{ project: Project }> {
  return apiRequest<{ project: Project }>('GET', `/projects/${slug}`, undefined, false);
}

// ============ TEAMS ============

/**
 * Create a new team
 */
export async function createTeam(name: string): Promise<{
  team: { id: number; name: string; inviteCode: string; memberCount: number };
}> {
  return apiRequest('POST', '/teams', { name });
}

/**
 * Join a team with invite code
 */
export async function joinTeam(inviteCode: string): Promise<{
  team: { id: number; name: string; memberCount: number };
}> {
  return apiRequest('POST', '/teams/join', { inviteCode });
}

/**
 * Leave current team
 */
export async function leaveTeam(): Promise<void> {
  await apiRequest('POST', '/teams/leave');
}

/**
 * Get my team info
 */
export async function getMyTeam(): Promise<{
  team: { id: number; name: string; inviteCode: string; memberCount: number } | null;
}> {
  try {
    return await apiRequest('GET', '/my-team');
  } catch (error) {
    if (error instanceof Error && error.message.includes('404')) {
      return { team: null };
    }
    throw error;
  }
}

// ============ HACKATHON INFO ============

/**
 * Get active hackathon info
 */
export async function getActiveHackathon(): Promise<{
  hackathon: {
    id: number;
    name: string;
    status: string;
    startsAt: string;
    endsAt: string;
    prizePool: string;
  };
}> {
  return apiRequest('GET', '/hackathons/active', undefined, false);
}

// ============ CLAIM & VERIFICATION ============

/**
 * Get claim info (for the human to verify)
 */
export async function getClaimInfo(claimCode: string): Promise<{
  claimCode: string;
  verificationCode: string;
  tweetTemplate: string;
  claimed: boolean;
}> {
  return apiRequest('GET', `/claim/${claimCode}/info`, undefined, false);
}

/**
 * Verify claim via tweet
 */
export async function verifyClaimTweet(
  claimCode: string,
  tweetUrl: string
): Promise<{ success: boolean; message: string }> {
  return apiRequest(
    'POST',
    `/claim/${claimCode}/verify-tweet`,
    { tweetUrl },
    false
  );
}

// ============ INITIALIZATION ============

/**
 * Initialize the hackathon agent.
 * - If no API key is set, provides instructions
 * - If API key exists, fetches status and ensures project is created
 */
export async function initializeAgent(): Promise<{
  registered: boolean;
  status: AgentStatus | null;
  project: Project | null;
}> {
  console.log('[Hackathon] Initializing agent...');

  // Check if API key exists
  const apiKey = process.env.HACKATHON_API_KEY;
  
  if (!apiKey) {
    console.log('[Hackathon] ⚠️  No HACKATHON_API_KEY found.');
    console.log('[Hackathon] To register a new agent, run:');
    console.log('');
    console.log('  npm run hackathon:register');
    console.log('');
    console.log('Or set HACKATHON_API_KEY in your .env file if you already have one.');
    return { registered: false, status: null, project: null };
  }

  try {
    // Get current status
    const status = await getStatus();
    console.log(`[Hackathon] ✅ Connected as: ${status.agent.name}`);
    console.log(`[Hackathon] Hackathon: ${status.hackathon.name} (${status.hackathon.status})`);

    // Check if project exists
    const { project } = await getMyProject();
    
    if (project) {
      console.log(`[Hackathon] Project: ${project.name} (${project.status})`);
    } else {
      console.log('[Hackathon] No project created yet.');
    }

    // Log next steps if available
    if (status.nextSteps && status.nextSteps.length > 0) {
      console.log('[Hackathon] Next steps:');
      status.nextSteps.forEach((step, i) => {
        console.log(`  ${i + 1}. ${step}`);
      });
    }

    return { registered: true, status, project };
  } catch (error) {
    console.error('[Hackathon] Failed to initialize:', error);
    return { registered: false, status: null, project: null };
  }
}

/**
 * Ensure our project exists, creating it if necessary
 */
export async function ensureProject(): Promise<Project> {
  const { project: existing } = await getMyProject();
  
  if (existing) {
    return existing;
  }

  // Create the Trading Caller project
  const { project } = await createProject({
    name: 'Trading Caller',
    description: 'Your AI trading companion for Solana. Trading Caller analyzes markets 24/7 using RSI, MACD, and trend detection to generate actionable trading signals with entry, targets, and stop-loss levels. Built by an AI agent that learns from its own performance.',
    repoLink: 'https://github.com/clawd-ai/trading-caller',
    solanaIntegration: 'Fetches real-time prices from Jupiter, analyzes token pairs, and generates trading signals for Solana tokens. Future: on-chain signal verification via PDAs.',
    tags: ['trading', 'ai'],
  });

  return project;
}

export default {
  registerAgent,
  getStatus,
  initializeAgent,
  ensureProject,
  createProject,
  updateProject,
  getMyProject,
  submitProject,
  createForumPost,
  getForumPosts,
  getForumPost,
  getMyForumPosts,
  createForumComment,
  getForumComments,
  getMyForumComments,
  voteOnPost,
  removePostVote,
  voteOnComment,
  searchForum,
  editForumPost,
  deleteForumPost,
  editForumComment,
  deleteForumComment,
  voteOnProject,
  removeProjectVote,
  getLeaderboard,
  getProjects,
  getProject,
  createTeam,
  joinTeam,
  leaveTeam,
  getMyTeam,
  getActiveHackathon,
  getClaimInfo,
  verifyClaimTweet,
};
