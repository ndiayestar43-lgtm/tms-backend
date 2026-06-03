import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { uploadBufferToCloudinary } from '../config/cloudinary';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import axios from 'axios';

export interface CardData {
  memberNumber: string;
  memberName: string;
  memberPhoto?: string;
  issueDate: Date;
  expiryDate: Date;
  status: string;
}

export interface GeneratedCard {
  pdfUrl: string;
  pdfPublicId: string;
  qrCodeUrl: string;
  qrCodeData: string;
}

// ========================
// GÉNÉRER LE QR CODE
// ========================

export const generateQRCode = async (memberId: string): Promise<string> => {
  const verifyUrl = `${env.PRODUCTION_URL}/verify/${memberId}`;
  const qrBuffer = await QRCode.toBuffer(verifyUrl, {
    errorCorrectionLevel: 'M',
    width: 200,
    margin: 1,
    color: { dark: '#0B4EA2', light: '#FFFFFF' },
  });
  return `data:image/png;base64,${qrBuffer.toString('base64')}`;
};

// ========================
// TÉLÉCHARGER UNE IMAGE
// ========================

const fetchImageBuffer = async (url: string): Promise<Buffer | null> => {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
    });
    return Buffer.from(response.data);
  } catch {
    return null;
  }
};

// ========================
// GÉNÉRER LA CARTE PDF
// ========================

export const generateMemberCardPDF = async (
  cardData: CardData
): Promise<GeneratedCard> => {
  try {
    logger.info(`Génération carte PDF pour : ${cardData.memberNumber}`);

    // 1. Générer le QR Code
    const verifyUrl = `${env.PRODUCTION_URL}/verify/${cardData.memberNumber}`;
    const qrBuffer = await QRCode.toBuffer(verifyUrl, {
      errorCorrectionLevel: 'M',
      width: 150,
      margin: 1,
      color: { dark: '#0B4EA2', light: '#FFFFFF' },
    });

    // 2. Upload QR Code vers Cloudinary
    const { url: qrCodeUrl, publicId: qrPublicId } = await uploadBufferToCloudinary(
      qrBuffer,
      'qrcodes',
      `qr_${cardData.memberNumber}`,
      'image'
    );

    // 3. Générer le PDF (format carte bancaire : 85.6mm x 53.98mm → ~243 x 153 pt)
    const CARD_WIDTH = 243;
    const CARD_HEIGHT = 153;

    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: [CARD_WIDTH, CARD_HEIGHT],
        margin: 0,
        info: {
          Title: `Carte Membre TMS - ${cardData.memberNumber}`,
          Author: 'Touba Mbacké Santé',
          Subject: 'Carte de membre officielle',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ── Fond dégradé bleu → vert
      // Recto de la carte
      const gradient = doc.linearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
      gradient.stop(0, '#0B4EA2');
      gradient.stop(0.6, '#1a6bc4');
      gradient.stop(1, '#16A34A');

      doc.rect(0, 0, CARD_WIDTH, CARD_HEIGHT).fill(gradient);

      // ── Cercles décoratifs
      doc
        .circle(CARD_WIDTH - 20, -20, 55)
        .fillOpacity(0.08)
        .fill('#FFFFFF');
      doc
        .circle(30, CARD_HEIGHT + 10, 40)
        .fillOpacity(0.05)
        .fill('#FFFFFF');
      doc.fillOpacity(1);

      // ── En-tête organisation
      doc
        .fillColor('#FFFFFF')
        .fontSize(6)
        .font('Helvetica')
        .text('TOUBA MBACKÉ SANTÉ', 12, 10, { letterSpacing: 1 });

      doc
        .fontSize(5)
        .fillColor('rgba(255,255,255,0.7)')
        .text('CARTE MEMBRE OFFICIELLE', 12, 18);

      // ── Ligne de séparation
      doc
        .moveTo(12, 27)
        .lineTo(CARD_WIDTH - 12, 27)
        .strokeColor('rgba(255,255,255,0.2)')
        .lineWidth(0.5)
        .stroke();

      // ── Photo membre (cercle)
      const photoX = 12;
      const photoY = 35;
      const photoRadius = 22;

      doc
        .save()
        .circle(photoX + photoRadius, photoY + photoRadius, photoRadius)
        .fillColor('rgba(255,255,255,0.15)')
        .fill()
        .restore();

      // Initiales en placeholder de photo
      const initials = cardData.memberName
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('');

      doc
        .fillColor('#FFFFFF')
        .fontSize(14)
        .font('Helvetica-Bold')
        .text(initials, photoX, photoY + 14, {
          width: photoRadius * 2,
          align: 'center',
        });

      // ── Informations du membre
      const infoX = photoX + photoRadius * 2 + 10;

      doc
        .fillColor('#FFFFFF')
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(cardData.memberName, infoX, 38, { width: 120, lineBreak: false });

      doc
        .fillColor('rgba(255,255,255,0.75)')
        .fontSize(7)
        .font('Helvetica')
        .text(cardData.memberNumber, infoX, 54);

      // Statut
      const isActive = cardData.status === 'active';
      const statusBg = isActive ? '#16A34A' : '#DC2626';
      const statusText = isActive ? '✓  ACTIF' : '✗  EXPIRÉ';

      doc
        .roundedRect(infoX, 64, 50, 12, 3)
        .fill(statusBg);

      doc
        .fillColor('#FFFFFF')
        .fontSize(6)
        .font('Helvetica-Bold')
        .text(statusText, infoX + 3, 67.5, { width: 44 });

      // ── QR Code (côté droit)
      const qrSize = 52;
      const qrX = CARD_WIDTH - qrSize - 12;
      const qrY = 33;

      // Fond blanc pour le QR
      doc.rect(qrX - 3, qrY - 3, qrSize + 6, qrSize + 6).fill('#FFFFFF');
      doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });

      // ── Ligne de séparation footer
      doc
        .moveTo(12, CARD_HEIGHT - 24)
        .lineTo(CARD_WIDTH - 12, CARD_HEIGHT - 24)
        .strokeColor('rgba(255,255,255,0.2)')
        .lineWidth(0.5)
        .stroke();

      // ── Footer
      const formatDate = (date: Date): string =>
        date.toLocaleDateString('fr-SN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });

      doc
        .fillColor('rgba(255,255,255,0.7)')
        .fontSize(6)
        .font('Helvetica')
        .text(`Émise : ${formatDate(cardData.issueDate)}`, 12, CARD_HEIGHT - 17);

      doc.text(
        `Expire : ${formatDate(cardData.expiryDate)}`,
        CARD_WIDTH / 2 - 20,
        CARD_HEIGHT - 17
      );

      // Slogan
      doc
        .fillColor('rgba(255,255,255,0.4)')
        .fontSize(5)
        .text('membre.tms.sn', CARD_WIDTH - 65, CARD_HEIGHT - 17);

      doc.end();
    });

    // 4. Upload PDF vers Cloudinary
    const { url: pdfUrl, publicId: pdfPublicId } = await uploadBufferToCloudinary(
      pdfBuffer,
      'cards',
      `card_${cardData.memberNumber}`,
      'raw'
    );

    logger.info(`Carte générée avec succès : ${cardData.memberNumber}`);

    return {
      pdfUrl,
      pdfPublicId,
      qrCodeUrl,
      qrCodeData: verifyUrl,
    };
  } catch (error) {
    logger.error('Erreur génération carte PDF :', error);
    throw new Error('Impossible de générer la carte membre.');
  }
};
