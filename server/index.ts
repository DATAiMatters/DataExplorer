import 'dotenv/config';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import graph from './routes/graph';
import skpImport from './routes/skp-import';
import health from './routes/health';
import { closeDriver } from './lib/neo4j';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Mount routes
app.route('/api/health', health);
app.route('/api/graph', graph);
app.route('/api/skp-import', skpImport);

// Graceful shutdown
const shutdown = async () => {
  console.log('\nShutting down...');
  await closeDriver();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start server
const port = parseInt(process.env.API_PORT || '3001');

console.log(`API server starting on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});

export default app;
