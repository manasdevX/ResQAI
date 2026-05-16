import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/authRoutes.js';
import incidentRoutes from './routes/incidentRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import shelterRoutes from './routes/shelterRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import { setupChatSocket } from './controllers/chatController.js';

// Load environment variables (suppress console tips)
dotenv.config({ quiet: true });

// Initialize Express App
const app = express();
const httpServer = createServer(app);

// Socket.io setup for real-time communication
export const io = new Server(httpServer, {
  cors: {
    origin: '*', // Adjust this to your frontend URL in production
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate Limiting to prevent API abuse
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  message: 'Too many requests from this IP, please try again after 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all requests (or you can apply it only to specific routes like /api)
app.use('/api', apiLimiter);

// Basic Route for testing
app.get('/', (req, res) => {
  res.send('ResQAI API is running...');
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/shelters', shelterRoutes);
app.use('/api/chat', chatRoutes);

// Socket.IO — chat handler (handles all chat:* events + online users)
setupChatSocket(io);

// Database Connection & Server Start
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

// Handle port already in use gracefully
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

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });
