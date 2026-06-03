import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { getAIResponse, ChatMessage } from '../services/ai.service';
import { AIConversation } from '../models/Log.model';
import { generateSessionId } from '../utils/jwt';
import { logger } from '../utils/logger';

// ========================
// POST /api/ai/chat
// ========================

export const chat = async (
  req: AuthRequest | Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { message, sessionId: existingSessionId } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({ success: false, message: 'Message requis.' });
      return;
    }

    if (message.length > 500) {
      res.status(400).json({ success: false, message: 'Message trop long (max 500 caractères).' });
      return;
    }

    const sessionId = existingSessionId || generateSessionId();
    const userId = (req as AuthRequest).user?.id;

    // Récupérer l'historique de conversation
    let conversation = await AIConversation.findOne({ sessionId });
    const history: ChatMessage[] = conversation
      ? conversation.messages.map((m) => ({ role: m.role, content: m.content }))
      : [];

    // Obtenir la réponse IA
    const aiResponse = await getAIResponse(history, message.trim());

    // Mettre à jour ou créer la conversation
    const newMessages = [
      { role: 'user' as const, content: message.trim(), createdAt: new Date() },
      { role: 'assistant' as const, content: aiResponse, createdAt: new Date() },
    ];

    if (conversation) {
      await AIConversation.findByIdAndUpdate(conversation._id, {
        $push: { messages: { $each: newMessages } },
      });
    } else {
      await AIConversation.create({
        user: userId || undefined,
        sessionId,
        messages: newMessages,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Réponse générée.',
      data: {
        sessionId,
        response: aiResponse,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ========================
// DELETE /api/ai/conversation
// ========================

export const clearConversation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { sessionId } = req.body;
    if (sessionId) {
      await AIConversation.findOneAndDelete({ sessionId });
    }
    res.status(200).json({ success: true, message: 'Conversation effacée.' });
  } catch (error) {
    next(error);
  }
};
