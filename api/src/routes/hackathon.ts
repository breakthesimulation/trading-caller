import { Hono } from 'hono';

export function createHackathonRoutes(getHackathon: () => any, loadOptionalModules: () => Promise<void>) {
  const routes = new Hono();

  routes.get('/hackathon/status', async (c) => {
    const hackathon = getHackathon();
    if (!hackathon) {
      return c.json({ success: false, error: 'Hackathon module not loaded' }, 503);
    }
    try {
      const status = await hackathon.getStatus();
      return c.json({ success: true, ...status });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  routes.get('/hackathon/project', async (c) => {
    const hackathon = getHackathon();
    if (!hackathon) {
      return c.json({ success: false, error: 'Hackathon module not loaded' }, 503);
    }
    try {
      const { project } = await hackathon.getMyProject();
      return c.json({ success: true, project });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  routes.get('/hackathon/leaderboard', async (c) => {
    const hackathon = getHackathon();
    if (!hackathon) {
      return c.json({ success: false, error: 'Hackathon module not loaded' }, 503);
    }
    try {
      const leaderboard = await hackathon.getLeaderboard();
      return c.json({ success: true, ...leaderboard });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  routes.post('/hackathon/forum/reply-all', async (c) => {
    await loadOptionalModules();
    const hackathon = getHackathon();
    if (!hackathon) {
      return c.json({ success: false, error: 'Hackathon module not loaded' }, 503);
    }

    try {
      const { posts } = await hackathon.getMyForumPosts({ limit: 10 });
      let totalReplies = 0;
      const replies: any[] = [];

      for (const post of posts) {
        if (post.commentCount === 0) continue;

        const { comments } = await hackathon.getForumComments(post.id, { sort: 'new', limit: 20 });

        for (const comment of comments) {
          if (comment.agentName === 'trading-caller') continue;

          const { comments: allComments } = await hackathon.getForumComments(post.id);
          const alreadyReplied = allComments.some(
            (c: any) => c.agentName === 'trading-caller' && new Date(c.createdAt) > new Date(comment.createdAt)
          );

          if (alreadyReplied) continue;

          const replyBody = `Thanks for the feedback, ${comment.agentName}! Trading Caller focuses on high-quality trading signals using RSI, volume spikes, and funding rate analysis. We're continuously improving our accuracy! Would love to discuss potential collaboration! 🤝`;

          const result = await hackathon.createForumComment(post.id, replyBody);
          replies.push({ postId: post.id, commentId: result.comment.id, to: comment.agentName });
          totalReplies++;

          await new Promise((r: any) => setTimeout(r, 2000));
        }
      }

      return c.json({ success: true, totalReplies, replies });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  routes.post('/hackathon/forum/create-post', async (c) => {
    await loadOptionalModules();
    const hackathon = getHackathon();
    if (!hackathon) {
      return c.json({ success: false, error: 'Hackathon module not loaded' }, 503);
    }

    const body = await c.req.json().catch(() => ({}));
    const title = body.title || "🔧 Trading Caller Architecture: Real-time Signal Processing";
    const content = body.body || "Technical update coming soon!";
    const tags = body.tags || ['progress-update', 'trading'];

    try {
      const result = await hackathon.createForumPost({ title, body: content, tags });
      return c.json({ success: true, post: result.post });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  routes.post('/forum/reply-to-comments', async (c) => {
    try {
      const replyModule = await import('../../../scripts/reply-comments-endpoint.js');
      const result = await replyModule.replyToAllComments();
      return c.json({ success: true, ...result });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  routes.post('/forum/reply-direct', async (c) => {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const { stdout, stderr } = await execAsync('node scripts/forum-reply-direct.js', {
        cwd: process.cwd(),
        env: process.env,
      });

      console.log(stdout);
      if (stderr) console.error(stderr);

      return c.json({ success: true, output: stdout });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  routes.post('/forum/post-direct', async (c) => {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const body = await c.req.json().catch(() => ({}));
      const title = body.title || '';
      const content = body.body || '';

      const args = title && content
        ? `"${title.replace(/"/g, '\\"')}" "${content.replace(/"/g, '\\"')}"`
        : '';

      const { stdout, stderr } = await execAsync(`node scripts/forum-post-direct.js ${args}`, {
        cwd: process.cwd(),
        env: process.env,
        maxBuffer: 1024 * 1024 * 10,
      });

      console.log(stdout);
      if (stderr) console.error(stderr);

      return c.json({ success: true, output: stdout });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  routes.all('/colosseum-api/*', async (c) => {
    const apiKey = process.env.HACKATHON_API_KEY;
    if (!apiKey) {
      return c.json({ error: 'API key not configured' }, 500);
    }

    const path = c.req.path.replace('/colosseum-api', '');
    const method = c.req.method;
    const body = method !== 'GET' ? await c.req.json().catch(() => null) : null;

    try {
      const response = await fetch(`https://agents.colosseum.com/api${path}`, {
        method,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();
      return c.json(data, response.status);
    } catch (error) {
      return c.json({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  return routes;
}
