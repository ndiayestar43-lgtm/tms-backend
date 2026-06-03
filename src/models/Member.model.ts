import mongoose, { Schema } from 'mongoose';
import { IMember, MemberStatus } from '../types';

const MemberSchema = new Schema<IMember>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    memberNumber: {
      type: String,
      required: true,
      unique: true,
      // Format : TMS-2026-000001
      match: [/^TMS-\d{4}-\d{6}$/, 'Format numéro membre invalide'],
    },
    status: {
      type: String,
      enum: Object.values(MemberStatus),
      default: MemberStatus.PENDING,
    },
    issueDate: {
      type: Date,
    },
    expiryDate: {
      type: Date,
    },
    renewalCount: {
      type: Number,
      default: 0,
    },
    qrCodeUrl: {
      type: String,
    },
    cardUrl: {
      type: String,
    },
    cardPublicId: {
      type: String,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Vérifie si la carte est active
MemberSchema.virtual('isActive').get(function () {
  return this.status === MemberStatus.ACTIVE && this.expiryDate > new Date();
});

// Vérifie si la carte expire dans moins de 30 jours
MemberSchema.virtual('expiringSoon').get(function () {
  if (!this.expiryDate) return false;
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  return this.expiryDate <= thirtyDaysFromNow && this.expiryDate > new Date();
});

MemberSchema.set('toJSON', { virtuals: true });

// Index
MemberSchema.index({ user: 1 });
MemberSchema.index({ memberNumber: 1 });
MemberSchema.index({ status: 1 });
MemberSchema.index({ expiryDate: 1 });
MemberSchema.index({ createdAt: -1 });

export const Member = mongoose.model<IMember>('Member', MemberSchema);
