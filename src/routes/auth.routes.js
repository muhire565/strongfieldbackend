import express from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import * as authController from '../controllers/auth.controller.js';

const router = express.Router();

const loginSchema = z.object({
  body: z.object({
    username: z.string().min(1),
    password: z.string().min(1),
    branch: z.enum(['HIGHWAY', 'MAIN', 'DEVELOPER'])
  })
});

router.post('/login', validate(loginSchema), authController.login);

import { supabaseAdmin } from '../services/supabase.admin.js';

router.get('/setup-dev', async (req, res) => {
  try {
    const { data: branch } = await supabaseAdmin.from('branches').select('id').eq('name', 'DEVELOPER').single();
    
    // Cleanup old failed attempts (by username and by email)
    await supabaseAdmin.from('profiles').delete().eq('username', 'developer');
    
    // Delete from auth by fetching users and finding the email
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
    const devUser = users.find(u => u.email === 'developer@system.local');
    if (devUser) {
      await supabaseAdmin.auth.admin.deleteUser(devUser.id);
    }

    // Create via API
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: 'developer@system.local',
      password: 'Password123!',
      email_confirm: true
    });
    if (authErr) return res.json({ error: authErr.message });

    const { error: profErr } = await supabaseAdmin.from('profiles').insert({
      id: authData.user.id,
      branch_id: branch.id,
      username: 'developer',
      role: 'developer',
      full_name: 'System Developer',
      is_active: true
    });
    if (profErr) return res.json({ error: profErr.message });

    res.json({ success: true, message: 'Developer created perfectly!' });
  } catch (err) {
    res.json({ error: err.message });
  }
});

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
