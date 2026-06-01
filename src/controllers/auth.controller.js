import { supabaseAdmin } from '../services/supabase.admin.js';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import WebSocket from 'ws';

const supabaseAnon = createClient(env.SUPABASE_URL || 'https://placeholder.supabase.co', env.SUPABASE_ANON_KEY || 'placeholder', {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { WebSocket: WebSocket }
});

// The prompt specifies to use supabase-auth directly from frontend for initial exchange to feel instant.
// However, the prompt also says:
// 3. Frontend calls Express endpoint POST /api/auth/login with { username, password, branch }
// 4. Express looks up profiles table... Uses linked auth.users email to call supabase.auth.signInWithPassword
// Wait, the prompt says "Login must feel instant — use Supabase Auth directly from the frontend for the initial token exchange (no round-trip to Express for auth). Express handles protected business API calls only."
// BUT then in "AUTHENTICATION FLOW (implement exactly as described)" it contradicts itself and lists the exact steps where frontend calls Express!
// I will implement the Express fallback just in case, but rely on frontend direct login if possible.
// Actually, I will follow the "AUTHENTICATION FLOW" exactly since it says "implement exactly as described".

export const login = async (req, res, next) => {
  try {
    const { username, password, branch } = req.body;

    // a. Look up profile
    const { data: branchData, error: branchErr } = await supabaseAdmin
      .from('branches')
      .select('id')
      .eq('name', branch.toUpperCase())
      .single();

    if (branchErr || !branchData) {
      console.error('Login Error - Branch not found:', branchErr);
      return res.status(401).json({ success: false, error: 'Invalid branch' });
    }

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, username, role, is_active, branch_id')
      .eq('username', username)
      .eq('branch_id', branchData.id)
      .single();

    if (profileErr || !profile || !profile.is_active) {
      console.error('Login Error - Profile error or inactive:', profileErr || 'Profile inactive or not found');
      return res.status(401).json({ success: false, error: 'Invalid credentials or inactive user' });
    }

    // c. Use profile's linked auth.users email... but we only have user ID.
    // Let's get the user email via admin api
    const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.getUserById(profile.id);
    if (userErr || !userData.user) {
      console.error('Login Error - User lookup failed:', userErr);
      return res.status(401).json({ success: false, error: 'User not found in auth system' });
    }

    // Call supabase signInWithPassword using ANON client!
    const { data: authData, error: authErr } = await supabaseAnon.auth.signInWithPassword({
      email: userData.user.email,
      password: password
    });

    if (authErr) {
      console.error('Login Error - Supabase signInWithPassword failed:', authErr);
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    return res.json({
      success: true,
      data: {
        session: authData.session,
        user: authData.user,
        profile: profile
      }
    });

  } catch (error) {
    next(error);
  }
};
