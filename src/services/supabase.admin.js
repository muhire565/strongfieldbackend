import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import WebSocket from 'ws';

// Polyfill WebSocket for Node < 22
globalThis.WebSocket = WebSocket;

const supabaseUrl = env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder';
const supabaseAnonKey = env.SUPABASE_ANON_KEY || 'placeholder';

// Admin client for backend operations, NEVER expose to frontend
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  global: {
    WebSocket: WebSocket
  }
});

// Helper to create a user-scoped client if needed (for user's JWT)
export const createScopedClient = (token) => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      },
      WebSocket: WebSocket
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
};
