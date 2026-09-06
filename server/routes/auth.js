/**
 * POST /api/auth/register  { username, password } -> { success, userId }
 * POST /api/auth/login     { username, password } -> { token, username }
 * Passwords hashed with bcrypt. Parameterized SQL only. Never log passwords.
 */
import '../config/env.js';
import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';

export const authRouter = Router();

const BCRYPT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '7d';
const USERNAME_MAX = 32;
const PASSWORD_MIN = 4;

function normalizeUsername(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > USERNAME_MAX) return null;
  return trimmed;
}

function normalizePassword(value) {
  if (typeof value !== 'string') return null;
  if (value.length < PASSWORD_MIN) return null;
  return value;
}

authRouter.post('/register', async (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = normalizePassword(req.body?.password);

  if (!username || !password) {
    res.status(400).json({ success: false, userId: null });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const [result] = await pool.execute(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      [username, passwordHash],
    );

    res.status(201).json({
      success: true,
      userId: String(result.insertId),
    });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ success: false, userId: null });
      return;
    }
    console.error('[auth/register]', err.code ?? err.message);
    res.status(500).json({ success: false, userId: null });
  }
});

authRouter.post('/login', async (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = normalizePassword(req.body?.password);

  if (!username || !password) {
    res.status(400).json({ token: null, username: null });
    return;
  }

  try {
    const [rows] = await pool.execute(
      'SELECT id, username, password_hash FROM users WHERE username = ? LIMIT 1',
      [username],
    );

    const user = rows[0];
    if (!user) {
      res.status(401).json({ token: null, username: null });
      return;
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      res.status(401).json({ token: null, username: null });
      return;
    }

    const token = jwt.sign(
      { userId: String(user.id), username: user.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );

    res.json({
      token,
      username: user.username,
    });
  } catch (err) {
    console.error('[auth/login]', err.code ?? err.message);
    res.status(500).json({ token: null, username: null });
  }
});
