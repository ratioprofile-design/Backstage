import { createClient } from '@supabase/supabase-js';

// Safe access to environment variables across Vite, Vercel, Node, and browser runtimes
const getEnv = (key: string): string => {
  try {
    // 1. Vite client-side environment variables (e.g. VITE_SUPABASE_URL)
    if (typeof import.meta !== 'undefined' && (import.meta as any)?.env) {
      const metaEnv = (import.meta as any).env;
      if (metaEnv[`VITE_${key}`]) return String(metaEnv[`VITE_${key}`]);
      if (metaEnv[key]) return String(metaEnv[key]);
    }
  } catch {}

  try {
    // 2. Build-time defined environment variables injected via vite define
    if (typeof process !== 'undefined' && process.env) {
      if (process.env[`VITE_${key}`]) return String(process.env[`VITE_${key}`]);
      if (process.env[key]) return String(process.env[key]);
    }
  } catch {}

  try {
    // 3. Browser window globals if injected
    if (typeof window !== 'undefined') {
      const w = window as any;
      if (w.__ENV__?.[`VITE_${key}`]) return String(w.__ENV__[`VITE_${key}`]);
      if (w.__ENV__?.[key]) return String(w.__ENV__[key]);
      if (w.process?.env?.[`VITE_${key}`]) return String(w.process.env[`VITE_${key}`]);
      if (w.process?.env?.[key]) return String(w.process.env[key]);
    }
  } catch {}

  return '';
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
    signInWithOAuth: async () => ({ data: { provider: 'google', url: null }, error: { message: 'Supabase not configured' } }),
    exchangeCodeForSession: async () => ({ data: { user: null, session: null }, error: { message: 'Supabase not configured' } }),
    signOut: async () => ({ error: null }),
    updateUser: async () => ({ data: { user: null }, error: null }),
  },
  from: () => {
    const chain = {
      upsert: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      single: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
      maybeSingle: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
      delete: () => chain,
      update: () => chain,
      insert: () => chain,
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
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      }
    })
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

/**
 * Upload binary file to Supabase Storage bucket 'vault-files' if available.
 * Returns public URL on success, or null to fall back to inline storage.
 */
export const uploadDocumentBinaryToStorage = async (
  projectId: string,
  fileName: string,
  dataUrl?: string
): Promise<string | null> => {
  if (!isSupabaseConfigured || !dataUrl || !dataUrl.startsWith('data:')) return null;
  try {
    const commaIndex = dataUrl.indexOf(',');
    if (commaIndex === -1) return null;
    const mimeMatch = dataUrl.substring(0, commaIndex).match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const base64Data = dataUrl.substring(commaIndex + 1);
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mime });

    const cleanName = (fileName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${projectId}/${Date.now()}_${cleanName}`;

    const { error } = await supabase.storage
      .from('vault-files')
      .upload(storagePath, blob, { upsert: true, contentType: mime });

    if (!error) {
      const { data } = supabase.storage.from('vault-files').getPublicUrl(storagePath);
      return data?.publicUrl || null;
    }
  } catch (e) {
    // Graceful fallback to inline data URL
  }
  return null;
};

/**
 * Save or update an individual document in Supabase Cloud
 */
export const saveProjectDocumentToCloud = async (
  projectId: string,
  doc: any,
  userId?: string
): Promise<boolean> => {
  if (!isSupabaseConfigured || !projectId) return false;

  try {
    const row = {
      id: doc.id,
      project_id: projectId,
      user_id: userId || null,
      title: doc.title || 'Untitled Document',
      title_ta: doc.titleTa || null,
      category: doc.category || 'SCRIPT',
      file_name: doc.fileName || 'document.pdf',
      file_size: doc.fileSize || null,
      file_type: doc.fileType || 'pdf',
      page_count: doc.pageCount || 1,
      uploaded_at: doc.uploadedAt || new Date().toISOString(),
      pdf_data_url: doc.pdfDataUrl || null,
      image_data_url: doc.imageDataUrl || null,
      audio_url: doc.audioUrl || null,
      duration_seconds: doc.durationSeconds || null,
      html_content: doc.htmlContent || null,
      text_content: doc.textContent || null,
      sheet_data: doc.sheetData || null,
      built_in_type: doc.builtInType || null,
      annotations: doc.annotations || [],
      author: doc.author || 'Production Member',
      is_archived: !!doc.isArchived,
      archived_at: doc.archivedAt || null,
      tags: doc.tags || [],
      status: doc.status || 'review',
      original_file_data_url: doc.originalFileDataUrl || null,
      original_file_name: doc.originalFileName || null,
      converted_docx_data_url: doc.convertedDocxDataUrl || null,
      is_bamini_converted: !!doc.isBaminiConverted,
      is_left_right_format: !!doc.isLeftRightFormat,
      left_right_doc_id: doc.leftRightDocId || null,
      source_doc_id: doc.sourceDocId || null,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('project_documents')
      .upsert(row, { onConflict: 'id' });

    if (error) {
      console.warn("Failed to upsert to project_documents table (it may not be created yet):", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Error saving document to Supabase:", err);
    return false;
  }
};

/**
 * Fetch all documents for a project from Supabase Cloud
 */
export const fetchProjectDocumentsFromCloud = async (projectId: string): Promise<any[] | null> => {
  if (!isSupabaseConfigured || !projectId) return null;

  try {
    const { data, error } = await supabase
      .from('project_documents')
      .select('*')
      .eq('project_id', projectId)
      .order('uploaded_at', { ascending: false });

    if (error) {
      // Table might not exist yet; return null to fall back
      return null;
    }

    if (!data) return [];

    return data.map((row: any) => ({
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      titleTa: row.title_ta,
      category: row.category,
      fileName: row.file_name,
      fileSize: row.file_size,
      fileType: row.file_type,
      pageCount: row.page_count,
      uploadedAt: row.uploaded_at,
      pdfDataUrl: row.pdf_data_url,
      imageDataUrl: row.image_data_url,
      audioUrl: row.audio_url,
      durationSeconds: row.duration_seconds,
      htmlContent: row.html_content,
      textContent: row.text_content,
      sheetData: row.sheet_data,
      builtInType: row.built_in_type,
      annotations: row.annotations || [],
      author: row.author,
      isArchived: !!row.is_archived,
      archivedAt: row.archived_at,
      tags: row.tags || [],
      status: row.status,
      originalFileDataUrl: row.original_file_data_url,
      originalFileName: row.original_file_name,
      convertedDocxDataUrl: row.converted_docx_data_url,
      isBaminiConverted: !!row.is_bamini_converted,
      isLeftRightFormat: !!row.is_left_right_format,
      leftRightDocId: row.left_right_doc_id,
      sourceDocId: row.source_doc_id
    }));
  } catch (err) {
    return null;
  }
};

/**
 * Delete a document from Supabase Cloud
 */
export const deleteProjectDocumentFromCloud = async (projectId: string, docId: string): Promise<boolean> => {
  if (!isSupabaseConfigured || !projectId || !docId) return false;
  try {
    const { error } = await supabase
      .from('project_documents')
      .delete()
      .eq('project_id', projectId)
      .eq('id', docId);
    return !error;
  } catch (err) {
    return false;
  }
};

