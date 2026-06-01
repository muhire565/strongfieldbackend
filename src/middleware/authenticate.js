import { supabaseAdmin, createScopedClient } from '../services/supabase.admin.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];

    // Verify token using supabase
    const supabase = createScopedClient(token);
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    // Attach user to req
    req.user = user;

    // Attach custom claims if available (or we can just fetch profile)
    // The prompt mentions custom JWT claims, but also mentions auth.me returns profile from DB.
    // We will just attach the user and let authorization middleware check claims or profile.
    
    // We can also attach the profile from DB for convenience if needed, but since it's an API, 
    // it's better to fetch it if needed, or rely on custom claims.
    // For now, let's fetch profile just to be safe as `authorize` will likely need it.
    
    // Since custom claims take time to setup in Supabase via Edge Functions, 
    // it's safer for this scaffold to fetch the profile.
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile || !profile.is_active) {
      return res.status(403).json({ success: false, error: 'User profile inactive or not found' });
    }

    req.profile = profile;
    next();
  } catch (error) {
    next(error);
  }
};
