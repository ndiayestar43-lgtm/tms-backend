import mongoose, { Schema } from 'mongoose';
import { IPayment, PaymentStatus, PaymentMethod } from '../types';

const PaymentSchema = new Schema<IPayment>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    member: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'Le montant ne peut pas être négatif'],
      // Montant en FCFA
    },
    currency: {
      type: String,
      default: 'XOF',
    },
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
    },
    method: {
      type: String,
      enum: Object.values(PaymentMethod),
    },
    paydunyaInvoiceToken: {
      type: String,
    },
    paydunyaTransactionId: {
      type: String,
    },
    receiptUrl: {
      type: String,
    },
    paidAt: {
      type: Date,
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

// Index
PaymentSchema.index({ user: 1 });
PaymentSchema.index({ member: 1 });
PaymentSchema.index({ status: 1 });
PaymentSchema.index({ paydunyaInvoiceToken: 1 });
PaymentSchema.index({ createdAt: -1 });
PaymentSchema.index({ paidAt: -1 });

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);
