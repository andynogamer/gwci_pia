/**
 * POST /api/auth/register  { username, password } -> { success, userId }
 * POST /api/auth/login     { username, password } -> { token, username }
 */
import { Router } from 'express';

export const authRouter = Router();

authRouter.post('/register', async (_req, res) => {
  res.status(501).json({ success: false, userId: null });
});

authRouter.post('/login', async (_req, res) => {
  res.status(501).json({ token: null, username: null });
});
