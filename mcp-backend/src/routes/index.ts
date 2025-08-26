import express from 'express';
import authRoutes from './auth';
import mcpRoutes from './mcp';

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
        health: '/api/health',
      },
    },
    timestamp: new Date().toISOString(),
  });
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/mcp', mcpRoutes);

export default router;