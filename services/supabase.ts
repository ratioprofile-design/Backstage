
import { createClient } from '@supabase/supabase-js';

// Safe access to environment variables
const getEnv = (key: string) => {
    try {
        return (window as any).process?.env?.[key] || '';
    } catch (e) {
        return '';
    }
};

const supabaseUrl = getEnv('SUPABASE_URL') || 'https://scvdsajwsuzstagjjltg.supabase.co';
const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjdmRzYWp3c3V6c3RhZ2pqbHRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxNjAzODcsImV4cCI6MjA4MjczNjM4N30._JbsT7W4NRESXqVggSE_Ahel6aXYOymPk9zlzYiMGGU';

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder'));

const mockSupabase = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: async () => ({ data: { user: null, session: null }, error: { message: 'Supabase not configured' } }),
    signUp: async () => ({ data: { user: null, session: null }, error: { message: 'Supabase not configured' } }),
    signOut: async () => ({ error: null }),
  },
  from: () => {
    const chain = {
      upsert: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      single: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
      delete: () => chain,
      then: (onfulfilled: any) => Promise.resolve({ data: [], error: null }).then(onfulfilled),
    };
    return chain;
  },
  storage: {
    from: () => ({
      upload: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
    }),
  },
};

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : mockSupabase as any;

export const upsertProject = async (id: string, userId: string, name: string, data: any) => {
  if (!isSupabaseConfigured) return;
  
  // Check if project already exists
  const { data: existing, error: checkError } = await supabase
    .from('projects')
    .select('id, user_id')
    .eq('id', id)
    .maybeSingle();

  if (existing && !checkError) {
    // Already exists: update data and name only. Keep the original owner user_id untouched.
    const { error } = await supabase
      .from('projects')
      .update({
        name,
        data,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
    if (error) throw error;
  } else {
    // New project: insert with current user as the owner
    const { error } = await supabase
      .from('projects')
      .insert({
        id,
        user_id: userId,
        name,
        data,
        updated_at: new Date().toISOString()
      });
    if (error) throw error;
  }
};

export const fetchUserProjects = async (userId: string) => {
  if (!isSupabaseConfigured) return [];
  
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }
  return data || [];
};

export const fetchProjectData = async (id: string) => {
  if (!isSupabaseConfigured) return null;
  
  const { data, error } = await supabase
    .from('projects')
    .select('data')
    .eq('id', id)
    .single();

  if (error) {
    throw error;
  }
  return data ? data.data : null;
};

export const inviteUserToProject = async (projectId: string, projectName: string, email: string, invitedBy?: string) => {
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('project_invites').insert({
        project_id: projectId,
        project_name: projectName,
        invitee_email: email.toLowerCase().trim(),
        invited_by: invitedBy || 'Collaborator',
        created_at: new Date().toISOString()
      });
      if (!error) return;
    } catch (e) {
      console.warn("Failed to save to project_invites table, falling back to local storage", e);
    }
  }

  const invites = JSON.parse(localStorage.getItem('simulated_invites') || '[]');
  // Avoid duplicate simulated invites
  const existingIdx = invites.findIndex((inv: any) => inv.project_id === projectId && inv.invitee_email === email.toLowerCase().trim());
  if (existingIdx !== -1) {
    invites[existingIdx] = {
      project_id: projectId,
      project_name: projectName,
      invitee_email: email.toLowerCase().trim(),
      invited_by: invitedBy || 'Collaborator'
    };
  } else {
    invites.push({
      project_id: projectId,
      project_name: projectName,
      invitee_email: email.toLowerCase().trim(),
      invited_by: invitedBy || 'Collaborator'
    });
  }
  localStorage.setItem('simulated_invites', JSON.stringify(invites));
};

export const fetchInvitedProjects = async (email: string) => {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('project_invites')
        .select('*')
        .eq('invitee_email', email.toLowerCase().trim());
      if (!error && data) {
        return data.map((inv: any) => ({
          id: inv.project_id,
          name: inv.project_name || 'Invited Project',
          invitedBy: inv.invited_by || 'Collaborator'
        }));
      }
    } catch (e) {
      console.warn("Failed to fetch from project_invites table, falling back to local storage", e);
    }
  }

  const invites = JSON.parse(localStorage.getItem('simulated_invites') || '[]');
  return invites
    .filter((inv: any) => inv.invitee_email === email.toLowerCase().trim())
    .map((inv: any) => ({
      id: inv.project_id,
      name: inv.project_name || 'Invited Project',
      invitedBy: inv.invited_by || 'Collaborator'
    }));
};
