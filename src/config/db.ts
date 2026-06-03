import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

export const connectDB = async (): Promise<void> => {
  try {
    mongoose.set('strictQuery', true);

    const conn = await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info(`✅ MongoDB connecté : ${conn.connection.host}`);

    mongoose.connection.on('disconnected', () => {
      logger.warn('⚠️  MongoDB déconnecté. Tentative de reconnexion...');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('✅ MongoDB reconnecté');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('❌ Erreur MongoDB :', err);
    });

  } catch (error) {
    logger.error('❌ Échec de connexion MongoDB :', error);
    process.exit(1);
  }
};

export const disconnectDB = async (): Promise<void> => {
  await mongoose.disconnect();
  logger.info('MongoDB déconnecté proprement');
};
