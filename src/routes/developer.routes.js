import express from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { supabaseAdmin } from '../services/supabase.admin.js';
import { insertNotification } from '../controllers/notifications.controller.js';

const router = express.Router();

// All developer routes require authentication + developer role
router.use(authenticate, authorize('developer'));

// GET /api/developer/users — fetch all users across all branches
router.get('/users', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select(`
        id, username, full_name, role, last_active, is_active, is_blocked, block_reason, branch_id,
        branches ( name, display_name )
      `)
      .order('last_active', { ascending: false, nullsFirst: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/developer/users/:id/block — block a user
router.patch('/users/:id/block', async (req, res, next) => {
  try {
    const { block_reason } = req.body;
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ is_blocked: true, block_reason })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/developer/users/:id/unblock — unblock a user
router.patch('/users/:id/unblock', async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ is_blocked: false, block_reason: null })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/developer/users/:id/notify — send real-time notification to a user
router.post('/users/:id/notify', async (req, res, next) => {
  try {
    const { message, branch_id } = req.body;

    await insertNotification({
      branchId: branch_id,
      userId: req.params.id,
      type: 'developer_message',
      title: '📢 Message from Developer',
      description: message,
      iconType: 'info'
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
