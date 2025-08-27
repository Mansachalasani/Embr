import express from 'express';
import authRoutes from './auth';
import mcpRoutes from './mcp';
import aiRoutes from './ai';
import sessionRoutes from './sessions';

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  });
});

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'MCP Orchestrator Backend',
      version: '1.0.0',
      description: 'MCP backend with Google Workspace integration and Supabase authentication',
      endpoints: {
        auth: '/api/auth/*',
        mcp: '/api/mcp/*',
        ai: '/api/ai/*',
        sessions: '/api/sessions/*',
        health: '/api/health',
      },
    },
    timestamp: new Date().toISOString(),
  });
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/mcp', mcpRoutes);
router.use('/ai', aiRoutes);
router.use('/sessions', sessionRoutes);

export default router;