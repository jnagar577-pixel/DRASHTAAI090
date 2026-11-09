import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import handler from './api/ask.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Delegate /api/ask and /api/sutra-consultation to the consultation handler
app.all(['/api/ask', '/api/sutra-consultation'], async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (err) {
    next(err);
  }
});

// Any unmatched /api route returns JSON 404, never the HTML SPA fallback
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API route not found', path: req.path });
});

// Vercel serves files in public/ through its CDN. Keep the local fallback
// pointed at the same public document for local development.
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir, {
  index: 'index.html',
  dotfiles: 'ignore'
}));

app.use((req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Keep unexpected Express errors from leaving the function in an undefined state.
app.use((err, req, res, next) => {
  console.error('Express request error:', err);
  if (res.headersSent) return next(err);
  return res.status(500).json({ error: 'Internal server error' });
});

// Vercel imports the default-exported Express app. Start a listener only locally.
if (!process.env.VERCEL) {
  app.listen(PORT, HOST, () => {
    console.log(`Drashta AI server running at http://${HOST}:${PORT}`);
  });
}

export default app;


