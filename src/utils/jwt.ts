import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { JwtPayload, TokenPair, UserRole } from '../types';

export const generateAccessToken = (payload: Omit<JwtPayload, 'iat' | 'exp'>): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
};

export const generateRefreshToken = (payload: Omit<JwtPayload, 'iat' | 'exp'>): string => {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
};

export const generateTokenPair = (payload: Omit<JwtPayload, 'iat' | 'exp'>): TokenPair => {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
};

export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
};

export const verifyRefreshToken = (token: string): JwtPayload => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
};

export const decodeToken = (token: string): JwtPayload | null => {
  try {
    return jwt.decode(token) as JwtPayload;
  } catch {
    return null;
  }
};

/**
 * Génère le numéro de membre au format TMS-{année}-{000000}
 */
export const generateMemberNumber = async (count: number): Promise<string> => {
  const year = new Date().getFullYear();
  const paddedCount = String(count + 1).padStart(6, '0');
  return `TMS-${year}-${paddedCount}`;
};

/**
 * Sanitise une chaîne de caractères pour éviter les injections
 */
export const sanitizeString = (str: string): string => {
  return str.replace(/[<>'"]/g, '').trim();
};

/**
 * Calcule la date d'expiration (1 an après la date donnée)
 */
export const calculateExpiryDate = (fromDate: Date = new Date()): Date => {
  const expiry = new Date(fromDate);
  expiry.setFullYear(expiry.getFullYear() + 1);
  return expiry;
};

/**
 * Formate un montant en FCFA
 */
export const formatAmount = (amount: number): string => {
  return new Intl.NumberFormat('fr-SN', {
    style: 'currency',
    currency: 'XOF',
    minimumFractionDigits: 0,
  }).format(amount);
};

/**
 * Génère un ID de session aléatoire
 */
export const generateSessionId = (): string => {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
};
