
import { createClient } from '@supabase/supabase-js';
import { ProjectState } from '../types';

/**
 * PRODUCTION CREDENTIALS
 */
const supabaseUrl = 'https://scvdsajwsuzstagjjltg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjdmRzYWp3c3V6c3RhZ2pqbHRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxNjAzODcsImV4cCI6MjA4MjczNjM4N30._JbsT7W4NRESXqVggSE_Ahel6aXYOymPk9zlzYiMGGU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// Table constant to ensure consistency throughout the app
const TABLE_NAME = 'backstage_data';

export const isSupabaseConfigured = () => !!supabase;

let hasShownSetupInstructions = false;

/**
 * Google Auth
 */
export const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { 
      redirectTo: window.location.origin,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    }
  });
  if (error) throw error;
};

export const signOut = async () => {
  await supabase.auth.signOut();
};

export const getCurrentSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) return null;
  return session;
};

const isValidUUID = (id: string) => {
    if (!id) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
};

export const getSupabaseProjectRef = () => {
    try {
        const url = new URL(supabaseUrl);
        return url.hostname.split('.')[0];
    } catch (e) {
        return '';
    }
};

/**
 * The CLEAN SQL required to set up the database.
 * Run this in the Supabase SQL Editor.
 */
export const SETUP_SQL = `
-- Drop remnants of old attempts
drop table if exists public."backstage data";
drop table if exists public.projects;

-- Create the definitive data table
create table if not exists public.${TABLE_NAME} (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  data jsonb not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS (Security)
alter table public.${TABLE_NAME} enable row level security;

-- Create access policy
drop policy if exists "Users can manage their own projects" on public.${TABLE_NAME};
create policy "Users can manage their own projects"
  on public.${TABLE_NAME} for all
  using (auth.uid() = user_id);
`.trim();

/**
 * Verifies if the table exists and is accessible
 */
export const checkDatabaseHealth = async (): Promise<{ ok: boolean; error?: string; code?: string }> => {
    try {
        const { error } = await supabase
            .from(TABLE_NAME)
            .select('id')
            .limit(1);
        
        if (error) {
            return { ok: false, error: error.message, code: error.code };
        }
        return { ok: true };
    } catch (e: any) {
        return { ok: false, error: e.message };
    }
};

const handleSupabaseError = (context: string, err: any) => {
    if (!err) return;

    if (err.code === 'PGRST205' || err.message?.includes('does not exist')) {
        if (!hasShownSetupInstructions) {
            console.error(`[Supabase Setup Required] Table '${TABLE_NAME}' is missing.`);
            console.info(`%cRun the CLEANUP SQL in your Supabase SQL Editor to fix:%c\n\n${SETUP_SQL}`, 
            "color: #f5a623; font-weight: bold;", "color: #ccc; font-family: monospace;");
            hasShownSetupInstructions = true;
        }
        return;
    }

    if (err.code === '22P02') return;

    console.error(`${context}:`, err);
};

/**
 * Project Operations
 */
export const saveProjectToCloud = async (id: string, name: string, userId: string, data: ProjectState) => {
  if (!isValidUUID(id) || !isValidUUID(userId)) return false;

  try {
    const { error } = await supabase
      .from(TABLE_NAME)
      .upsert({
        id,
        name,
        user_id: userId,
        data,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (error) throw error;
    return true;
  } catch (err: any) {
    handleSupabaseError("Cloud sync error", err);
    return false;
  }
};

export const fetchCloudProjects = async (userId: string) => {
  if (!isValidUUID(userId)) return [];

  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('id, name, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err: any) {
    handleSupabaseError("Cloud projects fetch failed", err);
    return [];
  }
};

export const fetchProjectData = async (id: string): Promise<ProjectState | null> => {
  if (!isValidUUID(id)) return null;

  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('data')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data?.data as ProjectState || null;
  } catch (err: any) {
    handleSupabaseError("Cloud data fetch error", err);
    return null;
  }
};

export const deleteCloudProject = async (id: string) => {
  if (!isValidUUID(id)) return true;

  try {
    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (err: any) {
    handleSupabaseError("Cloud deletion error", err);
    return false;
  }
};
