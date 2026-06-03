import mongoose, { Schema } from 'mongoose';
import { ICard } from '../types';

const CardSchema = new Schema<ICard>(
  {
    member: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    pdfUrl: {
      type: String,
      required: true,
    },
    pdfPublicId: {
      type: String,
      required: true,
    },
    qrCodeUrl: {
      type: String,
      required: true,
    },
    qrCodeData: {
      type: String,
      required: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
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

CardSchema.index({ member: 1 });
CardSchema.index({ user: 1 });
CardSchema.index({ generatedAt: -1 });

export const Card = mongoose.model<ICard>('Card', CardSchema);
