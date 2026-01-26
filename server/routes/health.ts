import { Hono } from 'hono';
import { getDriver } from '../lib/neo4j';

const health = new Hono();

health.get('/', async (c) => {
  const results = {
    server: 'ok',
    neo4j: { status: 'unknown', error: null as string | null },
    skp: { status: 'unknown', error: null as string | null },
    env: {
      NEO4J_URI: !!process.env.NEO4J_URI,
      NEO4J_USER: !!process.env.NEO4J_USER,
      NEO4J_PASSWORD: !!process.env.NEO4J_PASSWORD,
      SKP_API_BASE: !!process.env.SKP_API_BASE,
      SKP_API_USER: !!process.env.SKP_API_USER,
      SKP_API_PASSWORD: !!process.env.SKP_API_PASSWORD,
    },
  };

  // Test Neo4j connection
  try {
    const driver = getDriver();
    const session = driver.session();
    await session.run('RETURN 1');
    await session.close();
    results.neo4j.status = 'ok';
  } catch (e) {
    results.neo4j.status = 'error';
    results.neo4j.error = e instanceof Error ? e.message : String(e);
  }

  // Test SKP API connection
  try {
    const baseUrl = process.env.SKP_API_BASE;
    const user = process.env.SKP_API_USER;
    const password = process.env.SKP_API_PASSWORD;

    if (!baseUrl || !user || !password) {
      results.skp.status = 'missing_config';
      results.skp.error = 'SKP_API_BASE, SKP_API_USER, or SKP_API_PASSWORD not set';
    } else {
      const auth = Buffer.from(`${user}:${password}`).toString('base64');

      // Try a simple request to the base URL or a known endpoint
      const res = await fetch(baseUrl, {
        method: 'GET',
        headers: { Authorization: `Basic ${auth}` },
      });

      if (res.ok) {
        results.skp.status = 'ok';
      } else if (res.status === 401 || res.status === 403) {
        results.skp.status = 'auth_error';
        results.skp.error = `${res.status} ${res.statusText}`;
      } else {
        results.skp.status = 'reachable';
        results.skp.error = `${res.status} ${res.statusText} (API reachable but endpoint returned error)`;
      }
    }
  } catch (e) {
    results.skp.status = 'error';
    results.skp.error = e instanceof Error ? e.message : String(e);
  }

  const allOk = results.neo4j.status === 'ok' && (results.skp.status === 'ok' || results.skp.status === 'reachable');
  return c.json(results, allOk ? 200 : 503);
});

export default health;
