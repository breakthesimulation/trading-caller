/**
 * Hackathon Heartbeat - Periodic Sync
 * 
 * Fetches the heartbeat file and acts on checklist items.
 * Runs every 30 minutes via cron.
 */

import hackathon from './hackathon.js';
import forum from './forum.js';
import { db } from '../db/index.js';

const HEARTBEAT_URL = 'https://colosseum.com/heartbeat.md';
const SKILL_URL = 'https://colosseum.com/skill.md';

interface HeartbeatState {
  lastCheck: number;
  lastVersion: string | null;
  lastLeaderboardPosition: number | null;
  pendingTasks: string[];
}

/**
 * Fetch and parse the heartbeat file
 */
async function fetchHeartbeat(): Promise<string> {
  const response = await fetch(HEARTBEAT_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch heartbeat: ${response.status}`);
  }
  return response.text();
}

/**
 * Extract version from skill file to check for updates
 */
async function fetchSkillVersion(): Promise<string | null> {
  try {
    const response = await fetch(SKILL_URL);
    if (!response.ok) return null;
    
    const content = await response.text();
    const versionMatch = content.match(/version:\s*([^\n]+)/);
    return versionMatch ? versionMatch[1].trim() : null;
  } catch {
    return null;
  }
}

/**
 * Get the current heartbeat state from database
 */
function getState(): HeartbeatState {
  const lastCheckStr = db.getConfig('heartbeat_last_check');
  const lastVersion = db.getConfig('heartbeat_last_version');
  const lastPositionStr = db.getConfig('heartbeat_last_leaderboard_position');
  const pendingTasksStr = db.getConfig('heartbeat_pending_tasks');

  return {
    lastCheck: lastCheckStr ? parseInt(lastCheckStr) : 0,
    lastVersion,
    lastLeaderboardPosition: lastPositionStr ? parseInt(lastPositionStr) : null,
    pendingTasks: pendingTasksStr ? JSON.parse(pendingTasksStr) : [],
  };
}

/**
 * Save heartbeat state to database
 */
function saveState(state: Partial<HeartbeatState>): void {
  if (state.lastCheck !== undefined) {
    db.setConfig('heartbeat_last_check', String(state.lastCheck));
  }
  if (state.lastVersion !== undefined && state.lastVersion !== null) {
    db.setConfig('heartbeat_last_version', state.lastVersion);
  }
  if (state.lastLeaderboardPosition !== undefined) {
    db.setConfig('heartbeat_last_leaderboard_position', String(state.lastLeaderboardPosition));
  }
  if (state.pendingTasks !== undefined) {
    db.setConfig('heartbeat_pending_tasks', JSON.stringify(state.pendingTasks));
  }
}

/**
 * Check for new forum replies to our posts
 */
async function checkForumReplies(): Promise<{
  newReplies: Array<{ postId: number; title: string; commentCount: number }>;
}> {
  console.log('[Heartbeat] Checking for forum replies...');
  
  const newReplies: Array<{ postId: number; title: string; commentCount: number }> = [];

  try {
    const { posts } = await hackathon.getMyForumPosts({ limit: 20 });
    
    for (const post of posts) {
      const storedCount = db.getForumPostCommentCount(post.id);
      
      if (post.commentCount > storedCount) {
        newReplies.push({
          postId: post.id,
          title: post.title,
          commentCount: post.commentCount - storedCount,
        });
        
        // Update stored count
        db.updateForumPostCommentCount(post.id, post.commentCount);
      }
    }

    if (newReplies.length > 0) {
      console.log(`[Heartbeat] 📬 ${newReplies.length} posts have new replies!`);
    }
  } catch (error) {
    console.error('[Heartbeat] Failed to check forum replies:', error);
  }

  return { newReplies };
}

/**
 * Check leaderboard position changes
 */
async function checkLeaderboard(): Promise<{
  currentPosition: number | null;
  change: number | null;
  topProjects: Array<{ name: string; rank: number }>;
}> {
  console.log('[Heartbeat] Checking leaderboard...');

  try {
    const state = getState();
    const { projects } = await hackathon.getLeaderboard();
    
    // Find our project's position
    const { project: myProject } = await hackathon.getMyProject();
    let currentPosition: number | null = null;
    
    if (myProject) {
      const ourProject = projects.find(p => p.id === myProject.id);
      currentPosition = ourProject?.rank || null;
    }

    // Calculate change
    let change: number | null = null;
    if (currentPosition !== null && state.lastLeaderboardPosition !== null) {
      change = state.lastLeaderboardPosition - currentPosition; // Positive = moved up
    }

    // Save new position
    if (currentPosition !== null) {
      saveState({ lastLeaderboardPosition: currentPosition });
    }

    if (change !== null && change !== 0) {
      const direction = change > 0 ? '📈 up' : '📉 down';
      console.log(`[Heartbeat] Leaderboard position: ${currentPosition} (${direction} ${Math.abs(change)})`);
    }

    return {
      currentPosition,
      change,
      topProjects: projects.slice(0, 5).map(p => ({ name: p.name, rank: p.rank })),
    };
  } catch (error) {
    console.error('[Heartbeat] Failed to check leaderboard:', error);
    return { currentPosition: null, change: null, topProjects: [] };
  }
}

/**
 * Check for skill file version updates
 */
async function checkVersionUpdate(): Promise<{
  updated: boolean;
  oldVersion: string | null;
  newVersion: string | null;
}> {
  console.log('[Heartbeat] Checking for skill file updates...');

  const state = getState();
  const newVersion = await fetchSkillVersion();

  if (!newVersion) {
    return { updated: false, oldVersion: state.lastVersion, newVersion: null };
  }

  if (state.lastVersion && newVersion !== state.lastVersion) {
    console.log(`[Heartbeat] ⚠️  Skill file updated: ${state.lastVersion} → ${newVersion}`);
    saveState({ lastVersion: newVersion });
    return { updated: true, oldVersion: state.lastVersion, newVersion };
  }

  // First time seeing version
  if (!state.lastVersion) {
    saveState({ lastVersion: newVersion });
  }

  return { updated: false, oldVersion: state.lastVersion, newVersion };
}

/**
 * Check for hackathon deadline approaching
 */
async function checkDeadline(): Promise<{
  daysRemaining: number | null;
  isUrgent: boolean;
}> {
  try {
    const { hackathon: h } = await hackathon.getActiveHackathon();
    
    if (!h.endsAt) {
      return { daysRemaining: null, isUrgent: false };
    }

    const endDate = new Date(h.endsAt);
    const now = new Date();
    const msRemaining = endDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

    const isUrgent = daysRemaining <= 2;
    
    if (isUrgent) {
      console.log(`[Heartbeat] ⚠️  DEADLINE APPROACHING: ${daysRemaining} day(s) remaining!`);
    }

    return { daysRemaining, isUrgent };
  } catch {
    return { daysRemaining: null, isUrgent: false };
  }
}

/**
 * Run the full heartbeat cycle
 */
export async function runHeartbeat(): Promise<{
  success: boolean;
  versionUpdate: { updated: boolean; oldVersion: string | null; newVersion: string | null };
  forumReplies: { newReplies: Array<{ postId: number; title: string; commentCount: number }> };
  leaderboard: { currentPosition: number | null; change: number | null; topProjects: Array<{ name: string; rank: number }> };
  deadline: { daysRemaining: number | null; isUrgent: boolean };
  actions: string[];
}> {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║        Trading Caller Heartbeat          ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  const actions: string[] = [];

  try {
    // 1. Fetch heartbeat file (for logging/parsing)
    const heartbeatContent = await fetchHeartbeat();
    console.log(`[Heartbeat] Fetched heartbeat (${heartbeatContent.length} chars)`);

    // 2. Check for skill file version updates
    const versionUpdate = await checkVersionUpdate();
    if (versionUpdate.updated) {
      actions.push(`Re-fetch skill file (version ${versionUpdate.newVersion})`);
    }

    // 3. Check for forum replies
    const forumReplies = await checkForumReplies();
    if (forumReplies.newReplies.length > 0) {
      for (const reply of forumReplies.newReplies) {
        actions.push(`Reply to comments on "${reply.title}" (${reply.commentCount} new)`);
      }
    }

    // 4. Check leaderboard position
    const leaderboard = await checkLeaderboard();
    
    // 5. Check deadline
    const deadline = await checkDeadline();
    if (deadline.isUrgent) {
      actions.push('URGENT: Submit project before deadline!');
    }

    // 6. Run forum engagement if we haven't posted recently
    const lastEngagement = db.getConfig('last_forum_engagement');
    const lastEngagementTime = lastEngagement ? parseInt(lastEngagement) : 0;
    const hoursSinceEngagement = (Date.now() - lastEngagementTime) / (1000 * 60 * 60);
    
    if (hoursSinceEngagement > 4) {
      console.log('[Heartbeat] Running forum engagement...');
      await forum.engageWithForum();
      db.setConfig('last_forum_engagement', String(Date.now()));
    }

    // Save last check time
    saveState({ lastCheck: Date.now() });

    console.log('');
    console.log('[Heartbeat] ✅ Heartbeat complete');
    
    if (actions.length > 0) {
      console.log('[Heartbeat] Suggested actions:');
      actions.forEach((action, i) => console.log(`  ${i + 1}. ${action}`));
    }

    return {
      success: true,
      versionUpdate,
      forumReplies,
      leaderboard,
      deadline,
      actions,
    };
  } catch (error) {
    console.error('[Heartbeat] ❌ Heartbeat failed:', error);
    return {
      success: false,
      versionUpdate: { updated: false, oldVersion: null, newVersion: null },
      forumReplies: { newReplies: [] },
      leaderboard: { currentPosition: null, change: null, topProjects: [] },
      deadline: { daysRemaining: null, isUrgent: false },
      actions: [],
    };
  }
}

/**
 * Get time until next heartbeat should run
 */
export function getTimeUntilNextHeartbeat(): number {
  const state = getState();
  const intervalMs = 30 * 60 * 1000; // 30 minutes
  const nextRun = state.lastCheck + intervalMs;
  return Math.max(0, nextRun - Date.now());
}

/**
 * Check if heartbeat should run now
 */
export function shouldRunHeartbeat(): boolean {
  return getTimeUntilNextHeartbeat() === 0;
}

export default {
  runHeartbeat,
  getTimeUntilNextHeartbeat,
  shouldRunHeartbeat,
  checkForumReplies,
  checkLeaderboard,
  checkVersionUpdate,
  checkDeadline,
};
