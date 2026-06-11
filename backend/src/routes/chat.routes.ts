import { Router, Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import {
  sendMessage,
  getHistory,
  ValidationError,
  NotFoundError,
} from '../services/chat.service';
import { chatRateLimiter } from '../middleware/rateLimiter';

export const chatRouter = Router();

// ─── POST /chat/message ───────────────────────────────────────────────────────

chatRouter.post(
  '/message',
  [
    chatRateLimiter,
    body('message')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('message is required')
      .isLength({ max: 2000 })
      .withMessage('message must be at most 2000 characters'),
    body('sessionId')
      .optional()
      .isUUID()
      .withMessage('sessionId must be a valid UUID'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg });
      return;
    }

    try {
      const { message, sessionId } = req.body as {
        message: string;
        sessionId?: string;
      };

      const result = await sendMessage(message, sessionId);

      res.json({
        reply: result.reply,
        sessionId: result.sessionId,
      });
    } catch (err) {
      if (err instanceof ValidationError) {
        res.status(400).json({ error: err.message });
        return;
      }
      next(err);
    }
  }
);

// ─── GET /chat/history/:sessionId ────────────────────────────────────────────

chatRouter.get(
  '/history/:sessionId',
  [
    param('sessionId')
      .isUUID()
      .withMessage('sessionId must be a valid UUID'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg });
      return;
    }

    try {
      const { sessionId } = req.params;
      const history = await getHistory(sessionId);
      res.json(history);
    } catch (err) {
      if (err instanceof NotFoundError) {
        res.status(404).json({ error: err.message });
        return;
      }
      next(err);
    }
  }
);
