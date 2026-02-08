/**
 * Position API Routes
 * RESTful endpoints for position management
 */

import { Hono } from 'hono';
import * as manager from './manager.js';
import type { PositionStatus, PositionUpdate } from './types.js';

const app = new Hono();

/**
 * GET /positions
 * Get all positions with optional filtering
 */
app.get('/', (c) => {
  const status = c.req.query('status') as PositionStatus | undefined;
  const token = c.req.query('token');
  const limit = parseInt(c.req.query('limit') || '100');
  
  let positions = manager.getAllPositions();
  
  if (status) {
    positions = manager.getPositionsByStatus(status);
  }
  
  if (token) {
    positions = manager.getPositionsByToken(token);
  }
  
  positions = positions.slice(0, limit);
  
  return c.json({
    success: true,
    count: positions.length,
    positions: positions.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    ),
  });
});

/**
 * GET /positions/stats
 * Get position statistics
 */
app.get('/stats', (c) => {
  const stats = manager.getPositionStats();
  
  return c.json({
    success: true,
    stats,
  });
});

/**
 * GET /positions/active
 * Get active positions
 */
app.get('/active', (c) => {
  const positions = manager.getActivePositions();
  
  return c.json({
    success: true,
    count: positions.length,
    positions,
  });
});

/**
 * GET /positions/:id
 * Get specific position
 */
app.get('/:id', (c) => {
  const id = c.req.param('id');
  const position = manager.getPosition(id);
  
  if (!position) {
    return c.json({
      success: false,
      error: 'Position not found',
    }, 404);
  }
  
  return c.json({
    success: true,
    position,
  });
});

/**
 * PATCH /positions/:id
 * Update a position
 */
app.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const update: PositionUpdate = await c.req.json();
  
  const position = manager.updatePosition(id, update);
  
  if (!position) {
    return c.json({
      success: false,
      error: 'Position not found',
    }, 404);
  }
  
  return c.json({
    success: true,
    position,
  });
});

/**
 * POST /positions/:id/enter
 * Mark position as entered
 */
app.post('/:id/enter', async (c) => {
  const id = c.req.param('id');
  const { entryPrice } = await c.req.json();
  
  if (!entryPrice) {
    return c.json({
      success: false,
      error: 'entryPrice required',
    }, 400);
  }
  
  const position = manager.enterPosition(id, entryPrice);
  
  if (!position) {
    return c.json({
      success: false,
      error: 'Position not found',
    }, 404);
  }
  
  return c.json({
    success: true,
    position,
  });
});

/**
 * POST /positions/:id/close
 * Close a position
 */
app.post('/:id/close', async (c) => {
  const id = c.req.param('id');
  const { exitPrice, status } = await c.req.json();
  
  if (!exitPrice || !status) {
    return c.json({
      success: false,
      error: 'exitPrice and status required',
    }, 400);
  }
  
  if (!['PROFITABLE', 'LOSS', 'STOPPED_OUT'].includes(status)) {
    return c.json({
      success: false,
      error: 'Invalid status. Must be PROFITABLE, LOSS, or STOPPED_OUT',
    }, 400);
  }
  
  const position = manager.closePosition(id, exitPrice, status);
  
  if (!position) {
    return c.json({
      success: false,
      error: 'Position not found',
    }, 404);
  }
  
  return c.json({
    success: true,
    position,
  });
});

/**
 * POST /positions/:id/update-price
 * Update current price for active position
 */
app.post('/:id/update-price', async (c) => {
  const id = c.req.param('id');
  const { currentPrice } = await c.req.json();
  
  if (!currentPrice) {
    return c.json({
      success: false,
      error: 'currentPrice required',
    }, 400);
  }
  
  const position = manager.updateCurrentPrice(id, currentPrice);
  
  if (!position) {
    return c.json({
      success: false,
      error: 'Position not found or not active',
    }, 404);
  }
  
  return c.json({
    success: true,
    position,
  });
});

/**
 * DELETE /positions/:id
 * Delete a position (admin/testing only)
 */
app.delete('/:id', (c) => {
  const id = c.req.param('id');
  const success = manager.deletePosition(id);
  
  if (!success) {
    return c.json({
      success: false,
      error: 'Position not found',
    }, 404);
  }
  
  return c.json({
    success: true,
    message: 'Position deleted',
  });
});

export default app;
