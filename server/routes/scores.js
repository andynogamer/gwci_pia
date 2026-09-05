/**
 * POST /api/scores  Authorization: Bearer <token>  { score, mode, difficulty }
 * GET  /api/scores?limit=10
 */
import { Router } from 'express';

export const scoresRouter = Router();

scoresRouter.post('/', async (_req, res) => {
  res.status(501).json({ success: false });
});

scoresRouter.get('/', async (_req, res) => {
  res.json([]);
});
