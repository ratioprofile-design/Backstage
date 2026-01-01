
import { createClient } from '@supabase/supabase-js';

// These should be set in your environment
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

// Mock object to prevent runtime crashes if Supabase is not configured
// This allows the app to load and fall back to LocalStorage seamlessly
const mockSupabase = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: async () => ({ data: { user: null, session: null }, error: { message: 'Supabase not configured' } }),
    signUp: async () => ({ data: { user: null, session: null }, error: { message: 'Supabase not configured' } }),
    signOut: async () => ({ error: null }),
  },
  from: () => ({
    upsert: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
    select: () => ({
      eq: () => ({
        order: async () => ({ data: [], error: null }),
        single: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
      }),
      order: async () => ({ data: [], error: null }),
    }),
    delete: () => ({
      eq: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
    }),
  }),
  storage: {
    from: () => ({
      upload: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
    }),
  },
};

// Only initialize if keys are present to avoid "supabaseUrl is required" error
export const supabase = (supabaseUrl && supabaseAnonKey && supabaseUrl !== '' && supabaseAnonKey !== '')
  ? createClient(supabaseUrl, supabaseAnonKey)
  : mockSupabase as any;

/**
 * Storage helper: Uploads a base64 string or file to Supabase Storage
 * Returns the public URL
 */
export const uploadAsset = async (path: string, fileData: string | Blob): Promise<string | null> => {
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === '') {
    console.warn("Supabase not configured. Skipping asset upload.");
    return null;
  }
  
  try {
    let body: Blob | ArrayBuffer;
    let contentType = 'image/png';

    if (typeof fileData === 'string' && fileData.startsWith('data:')) {
      const response = await fetch(fileData);
      body = await response.blob();
      contentType = fileData.split(';')[0].split(':')[1];
    } else {
      body = fileData as Blob;
    }

    const { data, error } = await supabase.storage
      .from('assets')
      .upload(path, body, {
        contentType,
        upsert: true
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('assets')
      .getPublicUrl(data.path);

    return publicUrl;
  } catch (err) {
    console.error("Supabase Storage Error:", err);
    return null;
  }
};

/**
 * Database helper: Upsert project state
 */
export const upsertProject = async (id: string, userId: string, name: string, data: any) => {
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === '') return;
  
  const { error } = await supabase
    .from('projects')
    .upsert({
      id,
      user_id: userId,
      name,
      data,
      updated_at: new Date().toISOString()
    });
  
  if (error) throw error;
};

/**
 * Database helper: Fetch projects for a user
 */
export const fetchUserProjects = async (userId: string) => {
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === '') return [];
  
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

/**
 * Database helper: Fetch full project data
 */
export const fetchProjectData = async (id: string) => {
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === '') return null;
  
  const { data, error } = await supabase
    .from('projects')
    .select('data')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data ? data.data : null;
};
