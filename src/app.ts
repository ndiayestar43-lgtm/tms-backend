import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import { env } from './config/env';
import { connectDB } from './config/db';
import { logger } from './utils/logger';
import { globalRateLimit } from './middleware/validate.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

// Import des routes
import authRoutes from './routes/auth.routes';
import memberRoutes from './routes/member.routes';
import adminRoutes from './routes/admin.routes';

import paymentRoutes from './routes/payment.routes';
import cardRoutes from './routes/card.routes';
import aiRoutes from './routes/ai.routes';

const app = express();

// ========================
// SÉCURITÉ
// ========================

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS
const allowedOrigins = [
  env.FRONTEND_URL,
  env.PRODUCTION_URL,
  'https://membre.tms.sn',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origine non autorisée par CORS: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Sanitisation NoSQL
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    logger.warn(`Tentative d'injection NoSQL détectée - ${req.method} ${req.path} - Champ: ${key}`);
  },
}));

// Rate Limiting global
app.use(globalRateLimit);

// ========================
// PARSERS
// ========================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ========================
// LOGGING
// ========================

if (env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (message) => logger.http(message.trim()) },
    skip: (req) => req.url === '/health',
  }));
}

// ========================
// HEALTH CHECK
// ========================

app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'TMS Connect API is running',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// ========================
// ROUTES API
// ========================

app.use('/api/auth', authRoutes);
app.use('/api/member', memberRoutes);
app.use('/api/admin', adminRoutes);

// Phase 2+ 
app.use('/api/payment', paymentRoutes);
app.use('/api/card', cardRoutes);
app.use('/api/ai', aiRoutes);

// ========================
// GESTION DES ERREURS
// ========================

app.use(notFoundHandler);
app.use(errorHandler);

// ========================
// DÉMARRAGE DU SERVEUR
// ========================

const PORT = parseInt(env.PORT, 10);

const startServer = async (): Promise<void> => {
  try {
    await connectDB();

    app.listen(PORT, '0.0.0.0', () => {
      logger.info('');
      logger.info('╔══════════════════════════════════════╗');
      logger.info('║       TMS CONNECT API DÉMARRÉ        ║');
      logger.info('╠══════════════════════════════════════╣');
      logger.info(`║  Port        : ${PORT}                   ║`);
      logger.info(`║  Env         : ${env.NODE_ENV.padEnd(19)} ║`);
      logger.info(`║  URL         : http://localhost:${PORT}  ║`);
      logger.info('╚══════════════════════════════════════╝');
      logger.info('');
    });
  } catch (error) {
    logger.error('Erreur fatale au démarrage :', error);
    process.exit(1);
  }
};

// Gestion propre de l'arrêt
process.on('SIGTERM', async () => {
  logger.info('SIGTERM reçu. Arrêt propre...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT reçu. Arrêt propre...');
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Promesse rejetée non gérée :', reason);
});

startServer();

export default app;
