import dns from 'dns';
dns.setDefaultResultOrder('ipv4first'); // Render free tier has no IPv6 egress

import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import authRoutes from './routes/authRoutes.js';
import incidentRoutes from './routes/incidentRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import shelterRoutes from './routes/shelterRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import userRoutes from './routes/userRoutes.js';
import resourceRoutes from './routes/resourceRoutes.js';
import inviteRoutes from './routes/inviteRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import { setupChatSocket } from './controllers/chatController.js';

dotenv.config({ quiet: true });

const REQUIRED_ENV = ['MONGO_URI', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`\n❌ Missing required environment variables: ${missing.join(', ')}`);
  console.error('   Set them in backend/.env before starting the server.\n');
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.error('\n❌ JWT_SECRET must be at least 32 characters long for security.\n');
  process.exit(1);
}

const app = express();
const httpServer = createServer(app);

// Render (and most cloud platforms) sit behind a reverse proxy.
// Without this, express-rate-limit throws on X-Forwarded-For headers.
app.set('trust proxy', 1);

// Support multiple frontend origins: one env var can be a comma-separated list
// so that both the Vercel production URL and localhost work without separate vars.
const ALLOWED_ORIGINS = [
  ...(process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((u) => u.trim()).filter(Boolean)
    : []),
  'http://localhost:5173',
  'http://localhost:5174',
].filter(Boolean);

export const io = new Server(httpServer, {
  cors: {
    origin:      ALLOWED_ORIGINS,
    methods:     ['GET', 'POST'],
    credentials: true,
  },
});

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman, etc.)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    }
  },
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const apiLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             200,
  message:         'Too many requests from this IP, please try again after 15 minutes.',
  standardHeaders: true,
  legacyHeaders:   false,
});

// Stricter rate limit for auth endpoints to prevent brute force
const authLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             15,
  message:         'Too many authentication attempts. Please try again after 15 minutes.',
  standardHeaders: true,
  legacyHeaders:   false,
});

app.use('/api', apiLimiter);
app.use('/api/auth/login',           authLimiter);
app.use('/api/auth/signup',          authLimiter);
app.use('/api/auth/google',          authLimiter);
app.use('/api/auth/verify-otp',      authLimiter);
app.use('/api/auth/resend-otp',      authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password',  authLimiter);

app.get('/', (req, res) => res.send('ResQAI API is running...'));
app.get('/api/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

app.use('/api/auth',      authRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/report',    reportRoutes);
app.use('/api/shelters',  shelterRoutes);
app.use('/api/chat',      chatRoutes);
app.use('/api/users',     userRoutes);
app.use('/api/resources',  resourceRoutes);
app.use('/api/invites',    inviteRoutes);
app.use('/api/analytics',     analyticsRoutes);
app.use('/api/notifications', notificationRoutes);

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    socket.userRole = decoded.role || 'citizen';
    next();
  } catch {
    next(new Error('Invalid or expired token'));
  }
});

io.on('connection', (socket) => {
  // Join personal room so io.to(`user:${id}`) works for targeted notifications
  socket.join(`user:${socket.userId}`);

  // Join role room for role-wide broadcasts
  if (socket.userRole) {
    socket.join(`role:${socket.userRole}`);
  }

  socket.on('disconnect', () => {
    socket.leave(`user:${socket.userId}`);
  });
});


setupChatSocket(io);

const PORT = process.env.PORT || 5000;

httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use.`);
    console.error(`   Run this to free it: npx kill-port ${PORT}`);
    console.error('   Then restart the server.\n');
    process.exit(1);
  } else {
    throw err;
  }
});

mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`\n  ResQAI Server`);
      console.log(`  ✓ MongoDB    connected`);
      console.log(`  ✓ Socket.IO  running\n`);
    });
  })
  .catch((err) => {
    console.error(`\n  ✗ Failed to start: ${err.message}\n`);
    process.exit(1);
  });
