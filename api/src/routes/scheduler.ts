import { Hono } from 'hono';

export function createSchedulerRoutes(getScheduler: () => any) {
  const routes = new Hono();

  routes.get('/scheduler/status', (c) => {
    const scheduler = getScheduler();
    if (!scheduler) {
      return c.json({ success: false, error: 'Scheduler not loaded' }, 503);
    }
    const status = scheduler.getStatus();
    return c.json({ success: true, ...status });
  });

  routes.post('/scheduler/trigger/:task', async (c) => {
    const scheduler = getScheduler();
    if (!scheduler) {
      return c.json({ success: false, error: 'Scheduler not loaded' }, 503);
    }

    const task = c.req.param('task') as 'heartbeat' | 'outcomeCheck' | 'forumEngagement' | 'marketScan' | 'learning';

    const validTasks = ['heartbeat', 'outcomeCheck', 'forumEngagement', 'marketScan', 'learning'];
    if (!validTasks.includes(task)) {
      return c.json({ success: false, error: `Invalid task: ${task}` }, 400);
    }

    try {
      await scheduler.triggerTask(task);
      return c.json({ success: true, message: `Task ${task} triggered` });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  return routes;
}
