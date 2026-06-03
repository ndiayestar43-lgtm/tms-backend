import { Resend } from 'resend';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const resend = new Resend(env.RESEND_API_KEY);

const FROM = `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM}>`;

// ========================
// TEMPLATE DE BASE HTML
// ========================

const baseTemplate = (content: string, preheader = ''): string => `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TMS Connect</title>
  ${preheader ? `<span style="display:none;max-height:0;overflow:hidden">${preheader}</span>` : ''}
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F8FAFC; color: #0F172A; }
    .wrapper { max-width: 600px; margin: 32px auto; background: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #0B4EA2 0%, #1a6bc4 50%, #16A34A 100%); padding: 32px 40px; }
    .header h1 { color: #FFFFFF; font-size: 22px; font-weight: 600; margin-bottom: 4px; }
    .header p { color: rgba(255,255,255,0.75); font-size: 13px; }
    .body { padding: 36px 40px; }
    .btn { display: inline-block; background: #0B4EA2; color: #FFFFFF !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 20px 0; }
    .btn-green { background: #16A34A; }
    .info-box { background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 16px 20px; margin: 20px 0; }
    .info-box.blue { background: #EFF6FF; border-color: #BFDBFE; }
    .info-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(0,0,0,0.06); font-size: 13px; }
    .info-row:last-child { border: none; }
    .label { color: #64748B; }
    .value { font-weight: 500; }
    .footer { background: #F8FAFC; padding: 20px 40px; border-top: 1px solid #E2E8F0; text-align: center; }
    .footer p { font-size: 12px; color: #94A3B8; line-height: 1.6; }
    .footer a { color: #0B4EA2; text-decoration: none; }
    h2 { font-size: 18px; color: #0F172A; margin-bottom: 12px; }
    p { line-height: 1.7; color: #334155; font-size: 14px; margin-bottom: 12px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>TMS Connect</h1>
      <p>Touba Mbacké Santé · Au cœur du service communautaire</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      <p>
        © ${new Date().getFullYear()} Touba Mbacké Santé · membre.tms.sn<br>
        <a href="mailto:ndiayestar43@gmail.com">ndiayestar43@gmail.com</a> · +221 77 339 80 31
      </p>
    </div>
  </div>
</body>
</html>
`;

// ========================
// EMAIL : BIENVENUE
// ========================

export const sendWelcomeEmail = async (
  to: string,
  name: string,
  memberNumber: string
): Promise<void> => {
  const content = `
    <h2>Bienvenue, ${name} ! 🎉</h2>
    <p>Votre inscription à <strong>Touba Mbacké Santé</strong> a été enregistrée avec succès.</p>
    <div class="info-box blue">
      <div class="info-row"><span class="label">Nom</span><span class="value">${name}</span></div>
      <div class="info-row"><span class="label">Numéro de membre</span><span class="value">${memberNumber}</span></div>
      <div class="info-row"><span class="label">Email</span><span class="value">${to}</span></div>
    </div>
    <p>Pour finaliser votre adhésion et recevoir votre carte membre, effectuez votre cotisation annuelle de <strong>2 000 FCFA</strong>.</p>
    <a href="${env.PRODUCTION_URL}/dashboard/paiements" class="btn">Payer ma cotisation →</a>
    <p style="font-size:12px;color:#94A3B8">Si vous n'avez pas créé ce compte, ignorez cet email.</p>
  `;

  await sendEmail(to, `Bienvenue dans TMS Connect, ${name} !`, content, 'Bienvenue ! Votre inscription a été validée.');
};

// ========================
// EMAIL : PAIEMENT VALIDÉ
// ========================

export const sendPaymentSuccessEmail = async (
  to: string,
  name: string,
  memberNumber: string,
  amount: number,
  method: string,
  transactionId: string,
  expiryDate: Date,
  cardPdfUrl?: string
): Promise<void> => {
  const formatDate = (d: Date) =>
    d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  const content = `
    <h2>Paiement confirmé ✓</h2>
    <p>Votre cotisation a été validée. Votre carte membre est maintenant active.</p>
    <div class="info-box">
      <div class="info-row"><span class="label">Montant payé</span><span class="value">${amount.toLocaleString('fr-FR')} FCFA</span></div>
      <div class="info-row"><span class="label">Méthode</span><span class="value">${method}</span></div>
      <div class="info-row"><span class="label">Référence</span><span class="value">${transactionId}</span></div>
      <div class="info-row"><span class="label">Numéro membre</span><span class="value">${memberNumber}</span></div>
      <div class="info-row"><span class="label">Valide jusqu'au</span><span class="value">${formatDate(expiryDate)}</span></div>
    </div>
    ${cardPdfUrl ? `
    <p>Votre carte membre est prête. Téléchargez-la ou accédez à votre espace personnel.</p>
    <a href="${cardPdfUrl}" class="btn btn-green">Télécharger ma carte PDF →</a>
    ` : ''}
    <a href="${env.PRODUCTION_URL}/dashboard" class="btn">Accéder à mon espace →</a>
  `;

  await sendEmail(to, `Cotisation validée - Carte TMS ${memberNumber}`, content, 'Paiement confirmé, votre carte est prête.');
};

// ========================
// EMAIL : CARTE GÉNÉRÉE
// ========================

export const sendCardGeneratedEmail = async (
  to: string,
  name: string,
  memberNumber: string,
  cardPdfUrl: string
): Promise<void> => {
  const content = `
    <h2>Votre carte membre est prête ! 🪪</h2>
    <p>Bonjour ${name}, votre carte membre officielle <strong>${memberNumber}</strong> a été générée avec succès.</p>
    <div class="info-box">
      <p style="margin:0;font-size:13px">Votre carte peut être téléchargée en PDF ou présentée via le QR Code.</p>
    </div>
    <a href="${cardPdfUrl}" class="btn btn-green">Télécharger ma carte PDF →</a>
    <a href="${env.PRODUCTION_URL}/dashboard/carte" class="btn">Voir ma carte en ligne →</a>
    <p style="font-size:12px;color:#64748B">
      Vous pouvez vérifier la validité de votre carte sur :
      <a href="${env.PRODUCTION_URL}/verify/${memberNumber}">${env.PRODUCTION_URL}/verify/${memberNumber}</a>
    </p>
  `;

  await sendEmail(to, `Carte TMS ${memberNumber} générée`, content, 'Votre carte membre est disponible.');
};

// ========================
// EMAIL : RENOUVELLEMENT
// ========================

export const sendRenewalEmail = async (
  to: string,
  name: string,
  memberNumber: string,
  newExpiryDate: Date
): Promise<void> => {
  const formatDate = (d: Date) =>
    d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  const content = `
    <h2>Adhésion renouvelée ✓</h2>
    <p>Bonjour ${name}, votre adhésion à Touba Mbacké Santé a été renouvelée avec succès.</p>
    <div class="info-box">
      <div class="info-row"><span class="label">Numéro membre</span><span class="value">${memberNumber}</span></div>
      <div class="info-row"><span class="label">Nouvelle expiration</span><span class="value">${formatDate(newExpiryDate)}</span></div>
    </div>
    <a href="${env.PRODUCTION_URL}/dashboard/carte" class="btn">Télécharger ma nouvelle carte →</a>
  `;

  await sendEmail(to, `Renouvellement confirmé - ${memberNumber}`, content, 'Votre adhésion a été renouvelée.');
};

// ========================
// EMAIL : EXPIRATION PROCHE
// ========================

export const sendExpiryReminderEmail = async (
  to: string,
  name: string,
  memberNumber: string,
  expiryDate: Date,
  daysLeft: number
): Promise<void> => {
  const formatDate = (d: Date) =>
    d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  const content = `
    <h2>⚠️ Votre carte expire bientôt</h2>
    <p>Bonjour ${name}, votre carte membre <strong>${memberNumber}</strong> expire dans <strong>${daysLeft} jours</strong> (${formatDate(expiryDate)}).</p>
    <p>Renouvelez dès maintenant pour maintenir votre accès aux services de Touba Mbacké Santé.</p>
    <a href="${env.PRODUCTION_URL}/dashboard/paiements" class="btn">Renouveler pour 2 000 FCFA →</a>
  `;

  await sendEmail(to, `Rappel : votre carte TMS expire dans ${daysLeft} jours`, content, `Renouvelez avant le ${formatDate(expiryDate)}.`);
};

// ========================
// ENVOI GÉNÉRIQUE
// ========================

const sendEmail = async (
  to: string,
  subject: string,
  htmlContent: string,
  preheader = ''
): Promise<void> => {
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject,
      html: baseTemplate(htmlContent, preheader),
    });

    if (error) {
      logger.error(`Erreur envoi email à ${to} :`, error);
      throw error;
    }

    logger.info(`Email envoyé : "${subject}" → ${to}`);
  } catch (error) {
    logger.error(`Échec envoi email à ${to} :`, error);
    // On ne throw pas pour ne pas bloquer le flux principal
  }
};
