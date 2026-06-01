import express from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import * as usersController from '../controllers/users.controller.js';

const router = express.Router();

const createUserSchema = z.object({
  body: z.object({
    username: z.string().min(3),
    password: z.string().min(6),
    role: z.enum(['sales', 'stock_manager']),
    full_name: z.string().min(2),
  })
});

const updateUserSchema = z.object({
  body: z.object({
    password: z.string().min(6).optional(),
    role: z.enum(['sales', 'stock_manager']).optional(),
    full_name: z.string().min(2).optional(),
  })
});

// Protect all routes
router.use(authenticate, authorize('admin'));

router.get('/', usersController.getUsers);
router.post('/', validate(createUserSchema), usersController.createUser);
router.patch('/:id', validate(updateUserSchema), usersController.updateUser);
router.delete('/:id', usersController.deactivateUser);

export default router;
