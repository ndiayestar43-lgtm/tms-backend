import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const paydunyaHeaders = {
  'PAYDUNYA-MASTER-KEY': env.PAYDUNYA_MASTER_KEY,
  'PAYDUNYA-PRIVATE-KEY': env.PAYDUNYA_PRIVATE_KEY,
  'PAYDUNYA-TOKEN': env.PAYDUNYA_TOKEN,
  'Content-Type': 'application/json',
};

export interface PaydunyaInvoicePayload {
  userId: string;
  memberNumber: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  amount: number;
  description: string;
}

export interface PaydunyaInvoiceResponse {
  invoiceToken: string;
  checkoutUrl: string;
}

// ========================
// CRÉER UNE INVOICE
// ========================

export const createPaydunyaInvoice = async (
  payload: PaydunyaInvoicePayload
): Promise<PaydunyaInvoiceResponse> => {
  try {
    const baseUrl =
      env.PAYDUNYA_MODE === 'live'
        ? 'https://app.paydunya.com/api/v1'
        : 'https://app.paydunya.com/sandbox-api/v1';

    const body = {
      invoice: {
        items: {
          cotisation_tms: {
            name: `Cotisation TMS - ${new Date().getFullYear()}`,
            quantity: 1,
            unit_price: payload.amount,
            total_price: payload.amount,
            description: `Adhésion annuelle Touba Mbacké Santé - Membre ${payload.memberNumber}`,
          },
        },
        total_amount: payload.amount,
        description: payload.description,
      },
      store: {
        name: 'Touba Mbacké Santé',
        tagline: 'Au cœur du service communautaire',
        postal_address: 'Touba Mbacké, Sénégal',
        phone: '+221773398031',
        logo_url: `${env.PRODUCTION_URL}/logo.png`,
        website_url: env.PRODUCTION_URL,
      },
      actions: {
        cancel_url: `${env.PRODUCTION_URL}/paiement/annule`,
        return_url: `${env.PRODUCTION_URL}/paiement/succes`,
        callback_url: `${env.PRODUCTION_URL.replace('https://membre', 'https://api')}/api/payment/webhook`,
      },
      custom_data: {
        userId: payload.userId,
        memberNumber: payload.memberNumber,
        type: 'membership_payment',
      },
      customer: {
        name: payload.userName,
        email: payload.userEmail,
        phone: payload.userPhone,
      },
    };

    const response = await axios.post(
      `${baseUrl}/checkout-invoice/create`,
      body,
      { headers: paydunyaHeaders, timeout: 15000 }
    );

    if (response.data.response_code !== '00') {
      logger.error('PayDunya erreur création invoice :', response.data);
      throw new Error(response.data.response_text || 'Erreur PayDunya');
    }

    return {
      invoiceToken: response.data.token,
      checkoutUrl: response.data.response_text,
    };
  } catch (error) {
    logger.error('Erreur service PayDunya createInvoice :', error);
    throw new Error('Impossible de créer la facture de paiement.');
  }
};

// ========================
// VÉRIFIER UNE INVOICE
// ========================

export const verifyPaydunyaInvoice = async (
  token: string
): Promise<{
  status: string;
  transactionId: string;
  amount: number;
  paymentMethod: string;
  customData: Record<string, string>;
}> => {
  try {
    const baseUrl =
      env.PAYDUNYA_MODE === 'live'
        ? 'https://app.paydunya.com/api/v1'
        : 'https://app.paydunya.com/sandbox-api/v1';

    const response = await axios.get(
      `${baseUrl}/checkout-invoice/confirm/${token}`,
      { headers: paydunyaHeaders, timeout: 15000 }
    );

    return {
      status: response.data.status,
      transactionId: response.data.transaction_id || '',
      amount: response.data.invoice?.total_amount || 0,
      paymentMethod: response.data.payment_method || 'unknown',
      customData: response.data.custom_data || {},
    };
  } catch (error) {
    logger.error('Erreur vérification PayDunya :', error);
    throw new Error('Impossible de vérifier le paiement.');
  }
};

// ========================
// MAPPER LA MÉTHODE DE PAIEMENT
// ========================

export const mapPaymentMethod = (method: string): string => {
  const map: Record<string, string> = {
    'Orange Money': 'orange_money',
    'Wave': 'wave',
    'Free Money': 'free_money',
    'Expresso': 'expresso',
    'Visa': 'visa',
    'Mastercard': 'mastercard',
  };
  return map[method] || 'other';
};
