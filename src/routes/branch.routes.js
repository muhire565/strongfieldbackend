import express from 'express';
import { supabaseAdmin } from '../services/supabase.admin.js';

const router = express.Router();

// Public route to get all branches
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('branches')
      .select('id, name, display_name');

    if (error) {
      return res.status(500).json({ success: false, error: 'Failed to fetch branches' });
    }

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
