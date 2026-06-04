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
import { sanitizeRequest } from './middleware/sanitize.js';
import { protect, authorize } from './middleware/authMiddleware.js';

dotenv.config({ quiet: true });

const REQUIRED_ENV = ['MONGO_URI', 'JWT_SECRET', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);

if (!process.env.GEMINI_API_KEY) {
  console.warn('  ⚠  GEMINI_API_KEY not set — AI triage will be unavailable.');
}
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

// Strip MongoDB operator keys ($, .) from all incoming input to prevent
// NoSQL operator injection. Must run after body parsing, before any route.
app.use(sanitizeRequest);

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

// ── Weather proxy ─────────────────────────────────────────────────────────────
// Proxied server-side so browser CORS / Brave Shields cannot block it.
// Tries open-meteo first; falls back to wttr.in if unreachable.
app.get('/api/weather', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ message: 'lat and lon required' });
  try {
    let current_weather = null;
    let city = null;

    // ── Attempt 1: open-meteo ───────────────────────────────────────────────
    try {
      const wmRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (wmRes.ok) {
        const d = await wmRes.json();
        current_weather = d.current_weather;
      }
    } catch { /* fall through to wttr.in */ }

    // ── Attempt 2: wttr.in fallback ─────────────────────────────────────────
    if (!current_weather) {
      const wtRes = await fetch(
        `https://wttr.in/${lat},${lon}?format=j1`,
        { headers: { 'User-Agent': 'ResQAI/1.0' }, signal: AbortSignal.timeout(8000) }
      );
      if (wtRes.ok) {
        const d = await wtRes.json();
        const cc = d.current_condition?.[0];
        current_weather = {
          temperature:  parseFloat(cc?.temp_C  ?? cc?.temp_F ?? 0),
          windspeed:    parseFloat(cc?.windspeedKmph ?? 0),
          weathercode:  parseInt(cc?.weatherCode ?? 0),
          is_day:       cc?.is_day === 'yes' ? 1 : 0,
        };
        city = d.nearest_area?.[0]?.areaName?.[0]?.value || null;
      }
    }

    if (!current_weather) return res.status(503).json({ message: 'Weather service unavailable' });

    // ── Nominatim reverse-geocode for city name ─────────────────────────────
    if (!city) {
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
          { headers: { 'User-Agent': 'ResQAI/1.0' }, signal: AbortSignal.timeout(5000) }
        );
        if (geoRes.ok) {
          const geo  = await geoRes.json();
          const addr = geo.address || {};
          city = addr.city || addr.town || addr.district || addr.county || addr.suburb || null;
        }
      } catch { /* city stays null */ }
    }

    res.set('Cache-Control', 'private, max-age=300');
    res.json({ current_weather, city });
  } catch (err) {
    console.error('[weather proxy]', err.message);
    res.status(503).json({ message: 'Weather service unavailable' });
  }
});

// ── Debug endpoints ───────────────────────────────────────────────────────────
// Admin-only: these reveal credential status and actively call Gemini/Cloudinary,
// so they must not be reachable anonymously (quota-burn / info-leak vector).
const debugGuard = [protect, authorize('admin')];

// Credential presence check
app.get('/api/debug/credentials', ...debugGuard, (req, res) => res.json({
  cloudinary: {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? '✓ set' : '✗ missing',
    api_key:    process.env.CLOUDINARY_API_KEY    ? '✓ set' : '✗ missing',
    api_secret: process.env.CLOUDINARY_API_SECRET ? '✓ set' : '✗ missing',
  },
  gemini: { api_key: process.env.GEMINI_API_KEY ? '✓ set' : '✗ missing' },
}));

// Live credential test — actually calls both APIs to verify values are correct
app.get('/api/debug/test', ...debugGuard, async (req, res) => {
  const results = {};

  // ── Test Cloudinary ──────────────────────────────────────────────────────────
  try {
    const { v2: cloudinary } = await import('cloudinary');
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
      api_key:    process.env.CLOUDINARY_API_KEY?.trim(),
      api_secret: process.env.CLOUDINARY_API_SECRET?.trim(),
    });
    await cloudinary.api.ping();
    results.cloudinary = { ok: true, message: '✓ Credentials valid — Cloudinary API reachable' };
  } catch (err) {
    results.cloudinary = { ok: false, message: `✗ ${err.message || err.error?.message || 'Unknown error'}`, http_code: err.http_code };
  }

  // ── Test Gemini ──────────────────────────────────────────────────────────────
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await Promise.race([
      model.generateContent('Say "ok" in one word.'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timed out after 10s')), 10000)),
    ]);
    results.gemini = { ok: true, message: `✓ Credentials valid — response: "${result.response.text().trim()}"` };
  } catch (err) {
    results.gemini = { ok: false, message: `✗ ${err.message || 'Unknown error'}` };
  }

  res.json(results);
});

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
