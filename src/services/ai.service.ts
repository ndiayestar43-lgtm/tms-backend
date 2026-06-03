import OpenAI from 'openai';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `Tu es l'assistant officiel de Touba Mbacké Santé (TMS), une association communautaire sénégalaise.
Tu t'appelles "Assistant TMS".
Tu réponds UNIQUEMENT en français.
Tu es poli, professionnel et bienveillant.

Informations clés sur TMS Connect :
- Cotisation annuelle : 2 000 FCFA
- Moyens de paiement acceptés : Wave Sénégal, Orange Money, Free Money, Expresso, Visa, Mastercard
- Domaine : membre.tms.sn
- Contact admin : ndiayestar43@gmail.com / +221 77 339 80 31
- La carte membre est valable 1 an après paiement
- Le format du numéro de membre est : TMS-{année}-{numéro}
- La vérification de carte se fait sur : membre.tms.sn/verify/{numéro}

Tu peux aider pour :
1. FAQ : devenir membre, comment payer, renouveler, télécharger la carte
2. Support : problèmes de paiement, carte non reçue, accès au compte
3. Administration : statistiques générales, guide d'utilisation

Ce que tu ne fais PAS :
- Tu ne révèles pas d'informations personnelles de membres
- Tu ne fais pas de transactions financières
- Tu ne modifies pas les données
- Tu ne réponds pas dans une autre langue que le français
- Tu ne sors pas du cadre de TMS

Si la question dépasse tes capacités, dirige poliment l'utilisateur vers : ndiayestar43@gmail.com`;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const getAIResponse = async (
  messages: ChatMessage[],
  userMessage: string
): Promise<string> => {
  try {
    const conversationMessages = [
      ...messages.slice(-10), // Garder les 10 derniers échanges
      { role: 'user' as const, content: userMessage },
    ];

    const response = await openai.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...conversationMessages,
      ],
      max_tokens: 500,
      temperature: 0.7,
      presence_penalty: 0.1,
    });

    return response.choices[0]?.message?.content || 'Je suis désolé, je ne peux pas répondre pour le moment.';
  } catch (error) {
    logger.error('Erreur OpenAI :', error);
    throw new Error('Le service IA est temporairement indisponible.');
  }
};
