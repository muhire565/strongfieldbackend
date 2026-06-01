import { supabaseAdmin } from '../services/supabase.admin.js';

// GET /api/notifications
export const listNotifications = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const userId = req.user.id;
    const { type, read } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const page = Math.max(parseInt(req.query.page) || 1, 1);

    let query = supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    // Branch-wide (user_id IS NULL) OR personal (user_id = current user)
    query = query.or(`user_id.eq.${userId},user_id.is.null`);

    if (type) query = query.eq('type', type);
    if (read === 'true') query = query.eq('is_read', true);
    if (read === 'false') query = query.eq('is_read', false);

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({ success: true, data: data || [], count: count || 0, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
};

// GET /api/notifications/unread-count
export const unreadCount = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const userId = req.user.id;

    const { count, error } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', branchId)
      .eq('is_read', false)
      .or(`user_id.eq.${userId},user_id.is.null`);

    if (error) throw error;

    res.json({ success: true, count: count || 0 });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/notifications/:id/read
export const markRead = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const userId = req.user.id;
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('branch_id', branchId)
      .or(`user_id.eq.${userId},user_id.is.null`)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/notifications/read-all
export const markAllRead = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const userId = req.user.id;

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('branch_id', branchId)
      .eq('is_read', false)
      .or(`user_id.eq.${userId},user_id.is.null`);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// GET /api/notifications/activity
export const listActivity = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const { before, type } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);

    let query = supabaseAdmin
      .from('branch_activity_feed')
      .select('*')
      .eq('branch_id', branchId)
      .limit(limit);

    if (before) query = query.lt('event_time', before);
    if (type) query = query.eq('event_source', type);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('[listActivity] Error:', err.message);
    next(err);
  }
};

// Helper: insert notification (used by other controllers)
export async function insertNotification({ branchId, userId, type, title, description, iconType, referenceId, referenceType }) {
  const { error } = await supabaseAdmin
    .from('notifications')
    .insert({
      branch_id: branchId,
      user_id: userId || null,
      type,
      title,
      description,
      icon_type: iconType || 'info',
      reference_id: referenceId || null,
      reference_type: referenceType || null,
    });

  if (error) {
    console.error('Failed to insert notification:', error);
  }
}
