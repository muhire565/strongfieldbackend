import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

dotenv.config();

// Polyfill WebSocket for Node < 22
globalThis.WebSocket = WebSocket;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function seedAdmins() {
  try {
    // 1. Fetch branches
    const { data: branches, error: branchError } = await supabaseAdmin.from('branches').select('*');
    if (branchError) throw branchError;

    if (!branches || branches.length === 0) {
      console.log('No branches found. Please run the seed.sql script first.');
      return;
    }

    // 2. Create admins for each branch
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    for (const branch of branches) {
      const email = `admin@${branch.name.toLowerCase()}.strongfield.internal`;
      const password = 'admin123'; // Default password, should be changed upon first login

      // Check if profile already exists for this branch
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('username', 'admin')
        .eq('branch_id', branch.id)
        .maybeSingle();

      if (existingProfile) {
        console.log(`Admin profile already exists for branch ${branch.name}. Skipping.`);
        continue;
      }

      // Check if auth user exists (might exist from a previous incomplete run)
      const userExists = existingUsers.users.find(u => u.email === email);
      let userId;

      if (userExists) {
        console.log(`Auth user exists for ${branch.name}, creating missing profile...`);
        userId = userExists.id;
      } else {
        console.log(`Creating admin user for branch ${branch.name}...`);
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          password: password,
          email_confirm: true,
        });

        if (authError) {
          console.error(`Error creating auth user for ${branch.name}:`, authError.message);
          continue;
        }
        userId = authData.user.id;
      }

      const { error: profileError } = await supabaseAdmin.from('profiles').insert([
        {
          id: userId,
          username: 'admin',
          role: 'admin',
          branch_id: branch.id,
          full_name: `${branch.display_name} Admin`,
        }
      ]);

      if (profileError) {
        console.error(`Error creating profile for ${branch.name}:`, profileError.message);
      } else {
        console.log(`Successfully created admin profile for branch ${branch.name}.`);
      }
    }
    
    console.log('Admin seeding complete.');

  } catch (error) {
    console.error('Seed error:', error);
  }
}

seedAdmins();
