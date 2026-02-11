import { Hono } from 'hono';

export function createLearningRoutes(getModules: () => { tracker: any; learner: any }) {
  const routes = new Hono();

  routes.get('/learning/stats', (c) => {
    const { tracker } = getModules();
    if (!tracker) {
      return c.json({ success: false, error: 'Learning module not loaded' }, 503);
    }
    try {
      const stats = tracker.getPerformanceStats();
      return c.json({ success: true, stats });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  routes.get('/learning/tokens', (c) => {
    const { tracker } = getModules();
    if (!tracker) {
      return c.json({ success: false, error: 'Learning module not loaded' }, 503);
    }
    try {
      const performance = tracker.getTokenPerformance();
      return c.json({ success: true, ...performance });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  routes.get('/learning/insights', async (c) => {
    const { learner } = getModules();
    if (!learner) {
      return c.json({ success: false, error: 'Learning module not loaded' }, 503);
    }
    try {
      const insights = await learner.generateInsights();
      return c.json({ success: true, insights });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  routes.get('/learning/patterns', (c) => {
    const { learner } = getModules();
    if (!learner) {
      return c.json({ success: false, error: 'Learning module not loaded' }, 503);
    }
    try {
      const indicatorPatterns = learner.analyzeIndicatorPatterns();
      const tokenPatterns = learner.analyzeTokenPerformance();
      return c.json({ success: true, indicatorPatterns, tokenPatterns });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  return routes;
}
