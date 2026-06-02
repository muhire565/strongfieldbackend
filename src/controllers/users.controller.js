import { supabaseAdmin } from '../services/supabase.admin.js';
import { insertNotification } from './notifications.controller.js';

export const getUsers = async (req, res, next) => {
  try {
    const { branch_id } = req.profile;

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, username, role, full_name, is_active, last_active, created_at')
      .eq('branch_id', branch_id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createUser = async (req, res, next) => {
  try {
    const { username, password, role, full_name } = req.body;
    const adminProfile = req.profile;

    // Generate internal email
    const { data: branchData } = await supabaseAdmin.from('branches').select('name').eq('id', adminProfile.branch_id).single();
    const email = `${username}@${branchData.name.toLowerCase()}.strongfield.internal`;

    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authErr) return res.status(400).json({ success: false, error: authErr.message });

    const { data: profileData, error: profileErr } = await supabaseAdmin.from('profiles').insert([{
      id: authData.user.id,
      username,
      role,
      branch_id: adminProfile.branch_id,
      full_name,
      created_by: adminProfile.id
    }]).select().single();

    if (profileErr) {
      // rollback user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return res.status(400).json({ success: false, error: profileErr.message });
    }

    // Notification: new user created
    await insertNotification({
      branchId: adminProfile.branch_id,
      userId: null,
      type: 'new_user_created',
      title: `New user: ${username}`,
      description: `${full_name} joined as ${role}`,
      iconType: 'user-plus',
      referenceId: String(profileData.id),
      referenceType: 'user',
    });

    // Return sanitized
    res.status(201).json({ success: true, data: profileData });

  } catch (err) {
    next(err);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { password, ...profileUpdates } = req.body;

    // Prevent changing own role or status through this endpoint
    if (id === req.profile.id && (profileUpdates.role || profileUpdates.is_active !== undefined)) {
      return res.status(403).json({ success: false, error: 'Cannot modify your own role or status' });
    }

    if (password) {
      const { error: pwdErr } = await supabaseAdmin.auth.admin.updateUserById(id, { password });
      if (pwdErr) return res.status(400).json({ success: false, error: pwdErr.message });
    }

    if (Object.keys(profileUpdates).length > 0) {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .update({ ...profileUpdates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('branch_id', req.profile.branch_id)
        .select()
        .single();

      if (error) return res.status(400).json({ success: false, error: error.message });
      return res.json({ success: true, data });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

export const deactivateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (id === req.profile.id) {
      return res.status(403).json({ success: false, error: 'Cannot deactivate yourself' });
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('branch_id', req.profile.branch_id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const activateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('branch_id', req.profile.branch_id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const trackActivity = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ last_active: new Date().toISOString() })
      .eq('id', id)
      .eq('branch_id', req.profile.branch_id)
      .select('id, last_active')
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
