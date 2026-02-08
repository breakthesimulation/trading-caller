/**
 * AI Brain Module - LLM Integration
 * 
 * Uses Anthropic Claude API for:
 * - Generating natural forum posts
 * - Analyzing why calls worked/failed
 * - Making strategic decisions
 */

import Anthropic from '@anthropic-ai/sdk';

// Initialize client lazily
let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not set. AI brain features disabled.');
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

/**
 * Check if AI brain is available
 */
export function isAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// System prompt for Trading Caller personality
const SYSTEM_PROMPT = `You are Trading Caller, an AI trading companion for Solana. Your personality:

- You're confident but not arrogant about your trading signals
- You use occasional Matrix references naturally ("free your mind", "make the call", etc.)
- You're helpful and genuinely interested in the Solana ecosystem
- You explain technical concepts clearly without being condescending
- You acknowledge uncertainty - trading is probabilistic, not guaranteed
- You're collegial with other hackathon agents, supportive of the community
- You avoid hype, shilling, or making unrealistic promises

When writing forum posts:
- Be concise and valuable - no fluff
- Use emojis sparingly and naturally (1-2 per post max)
- Share genuine insights, not just self-promotion
- Ask questions that invite discussion
- Format with markdown when helpful

When analyzing trades:
- Be honest about what worked and what didn't
- Look for patterns in the data
- Suggest concrete improvements
- Don't make excuses for losses`;

interface ForumPostRequest {
  type: 'milestone' | 'technical' | 'performance' | 'feature' | 'discussion';
  data: Record<string, string | number>;
  context?: string;
}

interface ForumReplyRequest {
  postId: number;
  postTitle: string;
  postBody: string;
  ourProject: string;
}

interface TradeAnalysisRequest {
  token: string;
  action: 'LONG' | 'SHORT';
  entry: number;
  exit: number;
  result: 'WIN' | 'LOSS' | 'NEUTRAL';
  indicators: Record<string, number>;
  reasoning?: string;
}

/**
 * Generate a natural-sounding forum post
 */
export async function generateForumPost(request: ForumPostRequest): Promise<{
  title: string;
  body: string;
}> {
  const client = getClient();

  const dataStr = Object.entries(request.data)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  const prompt = `Generate a forum post for the Colosseum Agent Hackathon.

Post type: ${request.type}
Context: ${request.context || 'General update'}

Data to include:
${dataStr}

Requirements:
1. Title: 3-200 characters, engaging but not clickbait
2. Body: 100-500 characters, informative and conversational
3. Don't start with "Hey everyone" or similar generic openers every time
4. Include a question or call-to-action when appropriate

Return ONLY a JSON object like:
{"title": "...", "body": "..."}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4.5-20241022',
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  
  try {
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Fallback parsing
  }

  // Fallback
  return {
    title: `Trading Caller ${request.type} Update`,
    body: `Update on our progress: ${dataStr}. More details coming soon!`,
  };
}

/**
 * Generate a reply to a forum thread
 */
export async function generateForumReply(request: ForumReplyRequest): Promise<{
  body: string;
}> {
  const client = getClient();

  const prompt = `Generate a thoughtful reply to this hackathon forum post.

Their post title: "${request.postTitle}"
Their post body: "${request.postBody}"

Our project: ${request.ourProject}

Requirements:
1. Be helpful and add value to the discussion
2. If relevant, briefly mention how we might collaborate or share insights
3. Don't be salesy or spammy
4. Keep it to 100-300 characters
5. If the topic isn't related to what we do, just be supportive/friendly

Return ONLY a JSON object like:
{"body": "..."}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4.5-20241022',
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Fallback parsing
  }

  return {
    body: `Interesting project! We're building Trading Caller for Solana trading signals. Would love to hear more about your approach. Best of luck! 🤝`,
  };
}

/**
 * Analyze why a trade worked or failed
 */
export async function analyzeTradeOutcome(request: TradeAnalysisRequest): Promise<{
  analysis: string;
  lessonLearned: string;
  adjustmentSuggestion: string;
  confidenceAdjustment: number; // -10 to +10
}> {
  const client = getClient();

  const indicatorStr = Object.entries(request.indicators)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  const pnlPercent = ((request.exit - request.entry) / request.entry * 100).toFixed(2);

  const prompt = `Analyze this trade outcome:

Token: ${request.token}
Action: ${request.action}
Entry: $${request.entry}
Exit: $${request.exit}
P&L: ${pnlPercent}%
Result: ${request.result}

Indicators at entry:
${indicatorStr}

Original reasoning: ${request.reasoning || 'Not provided'}

Analyze:
1. What factors contributed to this ${request.result}?
2. What lesson should we learn for future signals?
3. Should we adjust our confidence in similar setups?

Return ONLY a JSON object like:
{
  "analysis": "Brief analysis of what happened",
  "lessonLearned": "Key takeaway for future",
  "adjustmentSuggestion": "How to improve signal generation",
  "confidenceAdjustment": 0
}

confidenceAdjustment should be -10 to +10:
- Positive if this outcome suggests we should trust this pattern more
- Negative if we should be more cautious
- Zero if this was expected variance`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4.5-20241022',
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Fallback parsing
  }

  return {
    analysis: `Trade ${request.result}: ${pnlPercent}% PnL on ${request.token}`,
    lessonLearned: 'Continue monitoring similar patterns',
    adjustmentSuggestion: 'No adjustment needed',
    confidenceAdjustment: 0,
  };
}

/**
 * Make a strategic decision
 */
export async function makeStrategicDecision(context: {
  situation: string;
  options: string[];
  constraints: string[];
  goal: string;
}): Promise<{
  decision: string;
  reasoning: string;
  nextSteps: string[];
}> {
  const client = getClient();

  const prompt = `Help me make a strategic decision for the hackathon.

Situation: ${context.situation}

Options:
${context.options.map((o, i) => `${i + 1}. ${o}`).join('\n')}

Constraints:
${context.constraints.map(c => `- ${c}`).join('\n')}

Goal: ${context.goal}

Analyze the options and recommend the best path forward.

Return ONLY a JSON object like:
{
  "decision": "The recommended option",
  "reasoning": "Why this is the best choice",
  "nextSteps": ["Step 1", "Step 2", "Step 3"]
}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4.5-20241022',
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Fallback parsing
  }

  return {
    decision: context.options[0] || 'Proceed with default option',
    reasoning: 'Unable to analyze fully, defaulting to first option',
    nextSteps: ['Gather more information', 'Re-evaluate decision'],
  };
}

/**
 * Generate a summary of our performance for the forum
 */
export async function generatePerformanceSummary(stats: {
  winRate: number;
  totalCalls: number;
  period: string;
  topWins: Array<{ token: string; pnl: number }>;
  topLosses: Array<{ token: string; pnl: number }>;
  patterns: string[];
}): Promise<{
  title: string;
  body: string;
}> {
  const client = getClient();

  const prompt = `Generate a performance summary forum post for Trading Caller.

Stats:
- Win Rate: ${stats.winRate.toFixed(1)}%
- Total Signals: ${stats.totalCalls}
- Period: ${stats.period}

Top Wins:
${stats.topWins.map(w => `- ${w.token}: +${w.pnl.toFixed(1)}%`).join('\n')}

Worst Losses:
${stats.topLosses.map(l => `- ${l.token}: ${l.pnl.toFixed(1)}%`).join('\n')}

Patterns observed:
${stats.patterns.join('\n')}

Requirements:
1. Be honest about both wins and losses
2. Share genuine insights, not just numbers
3. Invite feedback from the community
4. Keep body under 500 characters

Return ONLY a JSON object like:
{"title": "...", "body": "..."}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4.5-20241022',
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Fallback parsing
  }

  return {
    title: `📊 Trading Caller - ${stats.period} Performance`,
    body: `Win rate: ${stats.winRate.toFixed(1)}% across ${stats.totalCalls} signals. Top performer: ${stats.topWins[0]?.token || 'N/A'}. Still learning and improving! 🎯`,
  };
}

export default {
  isAvailable,
  generateForumPost,
  generateForumReply,
  analyzeTradeOutcome,
  makeStrategicDecision,
  generatePerformanceSummary,
};
