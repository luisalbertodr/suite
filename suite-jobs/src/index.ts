import { serve as nodeServe } from '@hono/node-server';
import { serve } from 'inngest/hono';
import { Hono } from 'hono';
import { inngest } from './inngest/client.js';
import { functions } from './inngest/functions.js';

const app = new Hono();
const port = Number(process.env.PORT || 3100);

app.get('/health', (c) =>
  c.json({
    ok: true,
    service: 'suite-jobs',
    functionCount: functions.length,
  }),
);

app.on(
  ['GET', 'PUT', 'POST'],
  '/api/inngest',
  serve({
    client: inngest,
    functions,
  }),
);

nodeServe({ fetch: app.fetch, port }, (info) => {
  console.log(`suite-jobs listening on :${info.port}`);
});
