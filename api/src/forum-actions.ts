/**
 * Forum Actions - Direct execution endpoints
 */
import { Hono } from 'hono';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const app = new Hono();

/**
 * Trigger forum replies NOW
 */
app.post('/trigger-replies', async (c) => {
  try {
    console.log('[ForumActions] Triggering forum replies...');
    
    const { stdout, stderr } = await execAsync('cd /app && tsx scripts/force-reply-now.ts', {
      timeout: 120000 // 2 minute timeout
    });
    
    return c.json({
      success: true,
      output: stdout,
      errors: stderr || null
    });
  } catch (error: any) {
    console.error('[ForumActions] Failed:', error);
    return c.json({
      success: false,
      error: error.message,
      output: error.stdout || null,
      errors: error.stderr || null
    }, 500);
  }
});

export default app;
