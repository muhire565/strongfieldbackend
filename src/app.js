import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';

// Import routes (will be created in next steps)
import authRoutes from './routes/auth.routes.js';
import usersRoutes from './routes/users.routes.js';
import branchRoutes from './routes/branch.routes.js';
import productsRoutes from './routes/products.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import posRoutes from './routes/pos.routes.js';
import financeRoutes from './routes/finance.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import developerRoutes from './routes/developer.routes.js';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: env.FRONTEND_ORIGIN,
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API is running' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/developer', developerRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path} — ${err.message}`);
  if (err.details) console.error('Details:', err.details);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

export default app;
