import express from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import * as authController from '../controllers/auth.controller.js';

const router = express.Router();

const loginSchema = z.object({
  body: z.object({
    username: z.string().min(1),
    password: z.string().min(1),
    branch: z.enum(['HIGHWAY', 'MAIN'])
  })
});

router.post('/login', validate(loginSchema), authController.login);

// GET /api/auth/me -> authenticate -> returns profile
import { authenticate } from '../middleware/authenticate.js';
router.get('/me', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      user: req.user,
      profile: req.profile
    }
  });
});

export default router;
