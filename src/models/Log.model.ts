import mongoose, { Schema } from 'mongoose';
import { INotification, IActivityLog, IAIConversation, NotificationType, UserRole } from '../types';

// ========================
// NOTIFICATION
// ========================

const NotificationSchema = new Schema<INotification>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

NotificationSchema.index({ user: 1, isRead: 1 });
NotificationSchema.index({ createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);

// ========================
// ACTIVITY LOG
// ========================

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    actor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    actorRole: {
      type: String,
      enum: Object.values(UserRole),
      required: true,
    },
    action: {
      type: String,
      required: true,
    },
    targetType: {
      type: String,
    },
    target: {
      type: Schema.Types.ObjectId,
    },
    details: {
      type: Schema.Types.Mixed,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  { timestamps: true }
);

ActivityLogSchema.index({ actor: 1 });
ActivityLogSchema.index({ action: 1 });
ActivityLogSchema.index({ createdAt: -1 });

export const ActivityLog = mongoose.model<IActivityLog>('ActivityLog', ActivityLogSchema);

// ========================
// AI CONVERSATION
// ========================

const AIConversationSchema = new Schema<IAIConversation>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    sessionId: {
      type: String,
      required: true,
    },
    messages: [
      {
        role: {
          type: String,
          enum: ['user', 'assistant'],
          required: true,
        },
        content: {
          type: String,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

AIConversationSchema.index({ sessionId: 1 });
AIConversationSchema.index({ user: 1 });
AIConversationSchema.index({ createdAt: -1 });

export const AIConversation = mongoose.model<IAIConversation>('AIConversation', AIConversationSchema);
