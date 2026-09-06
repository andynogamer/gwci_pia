/**
 * Agent-Network — HTTP + WebSocket entry. No rendering, no physics.
 */
import './config/env.js';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { authRouter } from './routes/auth.js';
import { scoresRouter } from './routes/scores.js';
import { RoomManager } from './ws/roomManager.js';

const PORT = Number(process.env.PORT ?? 3001);
const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/scores', scoresRouter);

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const rooms = new RoomManager();

wss.on('connection', (socket) => {
  rooms.handleConnection(socket);
});

server.listen(PORT, () => {
  console.log(`Micro-Tanks server listening on ${PORT}`);
});
