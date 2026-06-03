import { Request } from 'express';
import { Document, Types } from 'mongoose';

// ========================
// ENUMS
// ========================

export enum UserRole {
  MEMBER = 'member',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}

export enum MemberStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  SUSPENDED = 'suspended',
}

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum PaymentMethod {
  WAVE = 'wave',
  ORANGE_MONEY = 'orange_money',
  FREE_MONEY = 'free_money',
  EXPRESSO = 'expresso',
  VISA = 'visa',
  MASTERCARD = 'mastercard',
}

export enum NotificationType {
  REGISTRATION = 'registration',
  PAYMENT_SUCCESS = 'payment_success',
  CARD_GENERATED = 'card_generated',
  RENEWAL = 'renewal',
  EXPIRY_SOON = 'expiry_soon',
}

// ========================
// INTERFACES MONGOOSE
// ========================

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  isActive: boolean;
  address?: string;
  photo?: string;
  photoPublicId?: string;
  refreshToken?: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface IMember extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  memberNumber: string;
  status: MemberStatus;
  issueDate: Date;
  expiryDate: Date;
  renewalCount: number;
  qrCodeUrl?: string;
  cardUrl?: string;
  cardPublicId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPayment extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  member: Types.ObjectId;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method?: PaymentMethod;
  paydunyaInvoiceToken?: string;
  paydunyaTransactionId?: string;
  receiptUrl?: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICard extends Document {
  _id: Types.ObjectId;
  member: Types.ObjectId;
  user: Types.ObjectId;
  pdfUrl: string;
  pdfPublicId: string;
  qrCodeUrl: string;
  qrCodeData: string;
  version: number;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface INotification extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface IActivityLog extends Document {
  _id: Types.ObjectId;
  actor: Types.ObjectId;
  actorRole: UserRole;
  action: string;
  targetType?: string;
  target?: Types.ObjectId;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface IAIConversation extends Document {
  _id: Types.ObjectId;
  user?: Types.ObjectId;
  sessionId: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    createdAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

// ========================
// REQUEST AUGMENTÉE
// ========================

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    name: string;
  };
}

// ========================
// RÉPONSES API
// ========================

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  iat?: number;
  exp?: number;
}

// ========================
// QUERY PARAMS
// ========================

export interface PaginationQuery {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}
