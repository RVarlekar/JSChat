import { Router, Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import {
  sendMessage,
  getHistory,
  ValidationError,
  NotFoundError,
} from '../services/chat.service';
import { chatRateLimiter } from '../middleware/rateLimiter';
import { getStoreSettingsCached, updateStoreSettingsCached } from '../services/settings.service';

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

// ─── GET /chat/settings ───────────────────────────────────────────────────────

chatRouter.get('/settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await getStoreSettingsCached();
    res.json({
      agentName: settings.agent_name,
      agentAvatar: settings.agent_avatar,
      agentStatus: settings.agent_status,
      suggestions: settings.suggestions,
      storePolicies: settings.store_policies,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /chat/settings ──────────────────────────────────────────────────────

chatRouter.post(
  '/settings',
  [
    body('agentName').optional().isString().trim().notEmpty().withMessage('agentName must be a non-empty string'),
    body('agentAvatar').optional().isString().trim().notEmpty().withMessage('agentAvatar must be a non-empty string'),
    body('agentStatus').optional().isString().trim().notEmpty().withMessage('agentStatus must be a non-empty string'),
    body('storePolicies').optional().isString().trim().notEmpty().withMessage('storePolicies must be a non-empty string'),
    body('suggestions').optional().isArray().withMessage('suggestions must be an array of strings'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg });
      return;
    }

    try {
      const { agentName, agentAvatar, agentStatus, storePolicies, suggestions } = req.body as {
        agentName?: string;
        agentAvatar?: string;
        agentStatus?: string;
        storePolicies?: string;
        suggestions?: string[];
      };

      const updated = await updateStoreSettingsCached({
        agent_name: agentName,
        agent_avatar: agentAvatar,
        agent_status: agentStatus,
        store_policies: storePolicies,
        suggestions,
      });

      res.json({
        agentName: updated.agent_name,
        agentAvatar: updated.agent_avatar,
        agentStatus: updated.agent_status,
        suggestions: updated.suggestions,
        storePolicies: updated.store_policies,
      });
    } catch (err) {
      next(err);
    }
  }
);
