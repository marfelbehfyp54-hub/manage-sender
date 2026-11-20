import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import crypto from 'node:crypto';
import { pool } from './db.js';

dotenv.config();
const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '32kb' }));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'manage-sender-hybrid', time: new Date().toISOString() }));

function auth(req, res, next) {
  const expected = process.env.ADMIN_TOKEN || '';
  const header = req.headers.authorization || '';
  const supplied = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!expected || supplied.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}
app.use('/api', auth);

app.get('/api/senders', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id,label,phone,kind,status,created_at,updated_at FROM senders ORDER BY created_at DESC'
    );
    res.json({ senders: rows });
  } catch (e) { next(e); }
});

app.post('/api/senders', async (req, res, next) => {
  try {
    const { label, phone, kind } = req.body || {};
    const cleanPhone = String(phone || '').replace(/[^\d+]/g, '');
    if (!label || String(label).length > 60 || !/^\+?[1-9]\d{7,14}$/.test(cleanPhone) ||
        !['personal','business'].includes(kind)) {
      return res.status(400).json({ error: 'invalid_input', message: 'Isi label, nomor internasional, dan jenis personal/business.' });
    }
    const status = kind === 'personal' ? 'manual_link_required' : 'needs_meta_onboarding';
    const { rows } = await pool.query(
      `INSERT INTO senders(id,label,phone,kind,status)
       VALUES($1,$2,$3,$4,$5)
       RETURNING id,label,phone,kind,status,created_at,updated_at`,
      [crypto.randomUUID(), String(label).trim(), cleanPhone, kind, status]
    );
    res.status(201).json({ sender: rows[0] });
  } catch (e) { next(e); }
});

app.post('/api/senders/:id/refresh', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE senders SET status = CASE
         WHEN kind='personal' THEN 'manual_link_required'
         ELSE 'needs_meta_onboarding'
       END, updated_at=NOW()
       WHERE id=$1 RETURNING id,label,phone,kind,status,created_at,updated_at`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'not_found' });
    res.json({ sender: rows[0] });
  } catch (e) { next(e); }
});

app.delete('/api/senders/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM senders WHERE id=$1', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'not_found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
});

const port = Number(process.env.PORT || 8080);
app.listen(port, '0.0.0.0', () => console.log(`Manage Sender API listening on ${port}`));
