/**
 * Bearer JWT gate for POST /api/scores.
 * Does not log tokens. Payload must include userId.
 */
import '../config/env.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me';

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const userId = Number(payload.userId);
    if (!Number.isFinite(userId) || userId < 1) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    req.auth = { userId, username: String(payload.username ?? '') };
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}
