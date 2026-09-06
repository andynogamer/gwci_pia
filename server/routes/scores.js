/**
 * POST /api/scores  Authorization: Bearer <token>  { score, mode, difficulty }
 * GET  /api/scores?limit=10
 * Parameterized SQL only. CONTRACTS.md §C response shapes.
 */
import { Router } from 'express';
import { pool } from '../config/db.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const scoresRouter = Router();

const MODES = new Set(['PVE', 'PVP']);
const DIFFICULTIES = new Set(['EASY', 'HARD']);
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

scoresRouter.post('/', requireAuth, async (req, res) => {
  const score = Number(req.body?.score);
  const mode = req.body?.mode;
  const difficulty = req.body?.difficulty;

  if (!Number.isFinite(score) || !Number.isInteger(score) || score < 0) {
    res.status(400).json({ success: false });
    return;
  }
  if (!MODES.has(mode) || !DIFFICULTIES.has(difficulty)) {
    res.status(400).json({ success: false });
    return;
  }

  try {
    await pool.execute(
      'INSERT INTO scores (user_id, score, mode, difficulty) VALUES (?, ?, ?, ?)',
      [req.auth.userId, score, mode, difficulty],
    );
    res.status(201).json({ success: true });
  } catch (err) {
    console.error('[scores/post]', err.code ?? err.message);
    res.status(500).json({ success: false });
  }
});

scoresRouter.get('/', async (req, res) => {
  let limit = Number.parseInt(String(req.query.limit ?? DEFAULT_LIMIT), 10);
  if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  try {
    const [rows] = await pool.query(
      `SELECT u.username AS username,
              s.score AS score,
              s.mode AS mode,
              s.difficulty AS difficulty,
              s.created_at AS created_at
         FROM scores s
         INNER JOIN users u ON u.id = s.user_id
         ORDER BY s.score DESC, s.created_at ASC
         LIMIT ?`,
      [limit],
    );

    const payload = rows.map((row) => ({
      username: row.username,
      score: Number(row.score),
      mode: row.mode,
      difficulty: row.difficulty,
      created_at: toIso8601(row.created_at),
    }));

    res.json(payload);
  } catch (err) {
    console.error('[scores/get]', err.code ?? err.message);
    res.status(500).json([]);
  }
});

/**
 * @param {Date | string} value
 * @returns {string}
 */
function toIso8601(value) {
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString();
}
