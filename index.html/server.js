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

// Serve static assets from project root
app.use(express.static(__dirname, {
  index: 'index.html',
  dotfiles: 'ignore'
}));

// Fallback to index.html for all page requests (Express 5 compatible)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Drashta AI server running at http://${HOST}:${PORT}`);
});
