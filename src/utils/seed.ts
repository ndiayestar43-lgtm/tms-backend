import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from '../config/db';
import { User } from '../models/User.model';
import { Member } from '../models/Member.model';
import { Payment } from '../models/Payment.model';
import { UserRole, MemberStatus, PaymentStatus, PaymentMethod } from '../types';
import { generateMemberNumber, calculateExpiryDate } from './jwt';
import { logger } from './logger';

const seed = async (): Promise<void> => {
  try {
    await connectDB();
    logger.info('🌱 Démarrage du seeding...');

    // ========================
    // SUPER ADMIN
    // ========================

    const existingAdmin = await User.findOne({ email: process.env.ADMIN_EMAIL });
    if (!existingAdmin) {
      const admin = await User.create({
        name: process.env.ADMIN_NAME || 'Serigne Ndiaye',
        email: process.env.ADMIN_EMAIL || 'ndiayestar43@gmail.com',
        phone: '+221773398031',
        password: process.env.ADMIN_PASSWORD || 'TMS@Admin2026!',
        role: UserRole.SUPER_ADMIN,
        address: 'Touba Mbacké, Sénégal',
        isActive: true,
      });
      logger.info(`✅ Super Admin créé : ${admin.email}`);
    } else {
      logger.info('ℹ️  Super Admin existe déjà');
    }

    // ========================
    // MEMBRES DE TEST
    // ========================

    const testMembers = [
      {
        name: 'Aminata Diallo',
        email: 'aminata.diallo@gmail.com',
        phone: '+221771234567',
        address: 'Dakar, Sénégal',
        status: MemberStatus.ACTIVE,
        daysOffset: -30,
      },
      {
        name: 'Moussa Fall',
        email: 'moussa.fall@yahoo.fr',
        phone: '+221762345678',
        address: 'Thiès, Sénégal',
        status: MemberStatus.EXPIRED,
        daysOffset: -400,
      },
      {
        name: 'Fatou Sow',
        email: 'fatou.sow@hotmail.com',
        phone: '+221753456789',
        address: 'Saint-Louis, Sénégal',
        status: MemberStatus.ACTIVE,
        daysOffset: -60,
      },
      {
        name: 'Ibrahima Sarr',
        email: 'ibrahima.sarr@gmail.com',
        phone: '+221744567890',
        address: 'Ziguinchor, Sénégal',
        status: MemberStatus.PENDING,
        daysOffset: 0,
      },
      {
        name: 'Mariama Ba',
        email: 'mariama.ba@gmail.com',
        phone: '+221785678901',
        address: 'Kaolack, Sénégal',
        status: MemberStatus.ACTIVE,
        daysOffset: -15,
      },
    ];

    let memberCount = await Member.countDocuments();

    for (const testMember of testMembers) {
      const existing = await User.findOne({ email: testMember.email });
      if (existing) continue;

      const user = await User.create({
        name: testMember.name,
        email: testMember.email,
        phone: testMember.phone,
        password: 'TMS@Test2026!',
        role: UserRole.MEMBER,
        address: testMember.address,
        isActive: true,
      });

      const memberNumber = await generateMemberNumber(memberCount);
      memberCount++;

      const issueDate = new Date();
      issueDate.setDate(issueDate.getDate() + testMember.daysOffset);
      const expiryDate = calculateExpiryDate(issueDate);

      const member = await Member.create({
        user: user._id,
        memberNumber,
        status: testMember.status,
        issueDate: testMember.status !== MemberStatus.PENDING ? issueDate : undefined,
        expiryDate: testMember.status !== MemberStatus.PENDING ? expiryDate : undefined,
      });

      // Créer un paiement de test pour les membres actifs/expirés
      if (testMember.status !== MemberStatus.PENDING) {
        await Payment.create({
          user: user._id,
          member: member._id,
          amount: 2000,
          currency: 'XOF',
          status: PaymentStatus.COMPLETED,
          method: PaymentMethod.WAVE,
          paidAt: issueDate,
        });
      }

      logger.info(`✅ Membre test créé : ${testMember.name} (${memberNumber})`);
    }

    logger.info('🎉 Seeding terminé avec succès !');
    logger.info('');
    logger.info('📋 Comptes disponibles :');
    logger.info(`  Admin  : ${process.env.ADMIN_EMAIL} / ${process.env.ADMIN_PASSWORD}`);
    logger.info('  Membre : aminata.diallo@gmail.com / TMS@Test2026!');

  } catch (error) {
    logger.error('❌ Erreur lors du seeding :', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

seed();
