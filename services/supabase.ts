import { createClient } from '@supabase/supabase-js';
import { isR2Configured, uploadDocumentToR2 } from './r2Storage';

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
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      }
    })
  : mockSupabase as any;

/**
 * Executes a promise with an aggressive timeout.
 * Prevents cloud hanging from freezing the UI or sign-in flow.
 */
export function withTimeout<T = any>(promise: PromiseLike<T>, ms: number, fallbackOrErrorMsg?: string | [T][0]): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (typeof fallbackOrErrorMsg === 'string') {
        reject(new Error(fallbackOrErrorMsg));
      } else if (fallbackOrErrorMsg !== undefined) {
        resolve(fallbackOrErrorMsg as T);
      } else {
        reject(new Error(`Operation timed out after ${ms}ms`));
      }
    }, ms);

    Promise.resolve(promise)
      .then(res => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch(err => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export const upsertProject = async (id: string, userId: string, name: string, data: any) => {
  if (!isSupabaseConfigured) return;
  
  try {
    // Check if project already exists with timeout
    const checkQuery = supabase
      .from('projects')
      .select('id, user_id, name')
      .eq('id', id)
      .maybeSingle();

    const { data: existing, error: checkError } = await withTimeout(
      checkQuery as any,
      6000,
      { data: null, error: new Error('Timeout checking project') }
    );

    if (existing && !checkError) {
      const isOwner = existing.user_id === userId;
      // Collaborator saving MUST NOT rename the cloud project!
      // Only the project owner can update the project name.
      const updatePayload: any = {
        data,
        updated_at: new Date().toISOString()
      };
      if (isOwner && name && !name.includes('(Invited by')) {
        updatePayload.name = name;
      }
      const updateQuery = supabase
        .from('projects')
        .update(updatePayload)
        .eq('id', id);

      const { error } = await withTimeout(updateQuery as any, 8000, { error: null });
      if (error) console.warn('[supabase] update error:', error);
    } else {
      // New project: insert with current user as the owner
      const insertQuery = supabase
        .from('projects')
        .insert({
          id,
          user_id: userId,
          name,
          data,
          updated_at: new Date().toISOString()
        });
      const { error } = await withTimeout(insertQuery as any, 8000, { error: null });
      if (error) console.warn('[supabase] insert error:', error);
    }
  } catch (e) {
    console.warn('[supabase] upsertProject exception caught:', e);
  }
};

/**
 * Rename a cloud project (Owner only)
 */
export const renameCloudProject = async (id: string, userId: string, newName: string): Promise<boolean> => {
  if (!isSupabaseConfigured || !id || !userId || !newName.trim()) return false;
  try {
    const { data: existing, error: checkError } = await supabase
      .from('projects')
      .select('id, user_id, data')
      .eq('id', id)
      .maybeSingle();

    if (!existing || checkError || existing.user_id !== userId) {
      console.warn("Only project owner can rename this project.");
      return false;
    }

    const trimmed = newName.trim();
    const updatedData = existing.data ? { ...existing.data, projectName: trimmed } : undefined;

    const updatePayload: any = {
      name: trimmed,
      updated_at: new Date().toISOString()
    };
    if (updatedData) {
      updatePayload.data = updatedData;
    }

    const { error } = await supabase
      .from('projects')
      .update(updatePayload)
      .eq('id', id);

    if (error) {
      console.error("Failed to rename cloud project in projects table:", error);
      return false;
    }

    // 1. Sync updated project name into project_invites table for all collaborators
    try {
      await supabase
        .from('project_invites')
        .update({ project_name: trimmed })
        .eq('project_id', id);
    } catch (invErr) {
      console.warn("Failed to update project_invites table on rename:", invErr);
    }

    // 2. Sync local simulated invites if any exist
    try {
      const invites = JSON.parse(localStorage.getItem('simulated_invites') || '[]');
      const updated = invites.map((inv: any) => inv.project_id === id ? { ...inv, project_name: trimmed } : inv);
      localStorage.setItem('simulated_invites', JSON.stringify(updated));
    } catch (e) {}

    // 3. Broadcast real-time rename event across Supabase channels
    try {
      const globalChannel = supabase.channel('global_projects_sync');
      globalChannel.send({
        type: 'broadcast',
        event: 'project_renamed',
        payload: { id, newName: trimmed, updatedAt: new Date().toISOString() }
      });

      const projChannel = supabase.channel(`project_changes_${id}`);
      projChannel.send({
        type: 'broadcast',
        event: 'project_renamed',
        payload: { id, newName: trimmed, updatedAt: new Date().toISOString() }
      });
    } catch (bErr) {
      console.warn("Broadcast rename failed:", bErr);
    }

    return true;
  } catch (e) {
    console.error("Failed to rename cloud project:", e);
    return false;
  }
};

export const fetchUserProjects = async (userId: string) => {
  if (!isSupabaseConfigured) return [];
  
  try {
    const query = supabase
      .from('projects')
      .select('id, name, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    const { data, error } = await withTimeout<any>(
      query as any,
      6000,
      { data: null, error: new Error('fetchUserProjects timed out after 6000ms') }
    );

    if (error) {
      throw error;
    }

    if (data && Array.isArray(data)) {
      try {
        localStorage.setItem(`cached_cloud_projects_${userId}`, JSON.stringify(data));
      } catch {}
    }
    return data || [];
  } catch (err) {
    console.warn('[supabase] fetchUserProjects fallback to cache:', err);
    try {
      const cached = localStorage.getItem(`cached_cloud_projects_${userId}`);
      if (cached) return JSON.parse(cached);
    } catch {}
    return [];
  }
};

export const fetchProjectData = async (id: string) => {
  if (!isSupabaseConfigured) return null;
  
  try {
    const query = supabase
      .from('projects')
      .select('id, name, user_id, data')
      .eq('id', id)
      .single();

    const { data, error } = await withTimeout<any>(
      query as any,
      8000,
      { data: null, error: new Error('fetchProjectData timed out after 8000ms') }
    );

    if (error) {
      throw error;
    }
    if (!data) return null;
    return {
      ...(data.data || {}),
      _projectName: data.name,
      _ownerId: data.user_id,
      _projectId: data.id
    };
  } catch (err) {
    console.warn('[supabase] fetchProjectData failed or timed out:', err);
    try {
      const local = localStorage.getItem(`project_data_${id}`);
      if (local) return JSON.parse(local);
    } catch {}
    return null;
  }
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
  if (!email) return [];

  if (isSupabaseConfigured) {
    try {
      const invitesQuery = supabase
        .from('project_invites')
        .select('*')
        .eq('invitee_email', email.toLowerCase().trim());

      const { data, error } = await withTimeout(
        invitesQuery as any,
        5000,
        { data: null, error: new Error('Invited projects timeout') }
      );

      if (!error && data && data.length > 0) {
        // Query the live projects table to get the true current name and updated timestamp
        const projectIds = data.map((inv: any) => inv.project_id).filter(Boolean);
        let projectMap = new Map<string, any>();
        if (projectIds.length > 0) {
          try {
            const projsQuery = supabase
              .from('projects')
              .select('id, name, updated_at')
              .in('id', projectIds);

            const { data: projs } = await withTimeout(projsQuery as any, 4000, { data: null });
            if (projs) {
              projs.forEach((p: any) => projectMap.set(p.id, p));
            }
          } catch (pErr) {
            console.warn("Failed to join projects table for invites:", pErr);
          }
        }

        return data.map((inv: any) => {
          const liveProj = projectMap.get(inv.project_id);
          return {
            id: inv.project_id,
            name: liveProj?.name || inv.project_name || 'Invited Project',
            invitedBy: inv.invited_by || 'Collaborator',
            updated_at: liveProj?.updated_at || inv.created_at
          };
        });
      }
    } catch (e) {
      console.warn("Failed to fetch from project_invites table, falling back to local storage", e);
    }
  }

  const invites = JSON.parse(localStorage.getItem('simulated_invites') || '[]');
  return invites
    .filter((inv: any) => inv.invitee_email === email.toLowerCase().trim())
    .map((inv: any) => {
      const liveName = localStorage.getItem(`project_name_${inv.project_id}`) || inv.project_name || 'Invited Project';
      return {
        id: inv.project_id,
        name: liveName,
        invitedBy: inv.invited_by || 'Collaborator'
      };
    });
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
  if (!dataUrl) return null;
  // If it is already a hosted public URL, return directly
  if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) {
    return dataUrl;
  }
  if (!dataUrl.startsWith('data:')) return null;

  // 1. Try Cloudflare R2 first (Zero Egress fees)
  if (isR2Configured) {
    try {
      const r2Url = await uploadDocumentToR2(projectId, fileName, dataUrl);
      if (r2Url) return r2Url;
    } catch (r2Err) {
      console.warn('[R2 Storage] Document upload notice, trying Supabase fallback:', r2Err);
    }
  }

  if (!isSupabaseConfigured) return null;

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
    } else {
      console.warn('[Supabase Storage] Upload error:', error.message);
    }
  } catch (e) {
    console.warn('[Supabase Storage] Upload exception:', e);
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
    let resolvedUserId = userId;
    if (!resolvedUserId) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        resolvedUserId = session?.user?.id;
      } catch {}
    }

    let pdfUrl = doc.pdfDataUrl || null;
    let originalFileUrl = doc.originalFileDataUrl || null;
    let imageUrl = doc.imageDataUrl || null;
    let docxUrl = doc.convertedDocxDataUrl || null;
    let audioUrl = doc.audioUrl || null;
    let videoUrl = doc.videoUrl || null;

    // Offload heavy base64 data URLs (>25KB) to Supabase Storage bucket 'vault-files' if configured
    if (pdfUrl && pdfUrl.startsWith('data:') && pdfUrl.length > 25000) {
      try {
        const uploaded = await uploadDocumentBinaryToStorage(projectId, doc.fileName || `${doc.id}.pdf`, pdfUrl);
        if (uploaded) {
          pdfUrl = uploaded;
          doc.pdfDataUrl = uploaded;
        }
      } catch {}
    }

    if (originalFileUrl && originalFileUrl.startsWith('data:') && originalFileUrl.length > 25000) {
      try {
        const uploaded = await uploadDocumentBinaryToStorage(projectId, doc.originalFileName || doc.fileName || `${doc.id}_orig`, originalFileUrl);
        if (uploaded) {
          originalFileUrl = uploaded;
          doc.originalFileDataUrl = uploaded;
        }
      } catch {}
    }

    if (imageUrl && imageUrl.startsWith('data:') && imageUrl.length > 25000) {
      try {
        const uploaded = await uploadDocumentBinaryToStorage(projectId, `${doc.id}_img`, imageUrl);
        if (uploaded) {
          imageUrl = uploaded;
          doc.imageDataUrl = uploaded;
        }
      } catch {}
    }

    if (docxUrl && docxUrl.startsWith('data:') && docxUrl.length > 25000) {
      try {
        const uploaded = await uploadDocumentBinaryToStorage(projectId, `${doc.id}_converted.docx`, docxUrl);
        if (uploaded) {
          docxUrl = uploaded;
          doc.convertedDocxDataUrl = uploaded;
        }
      } catch {}
    }

    if (audioUrl && audioUrl.startsWith('data:') && audioUrl.length > 25000) {
      try {
        const uploaded = await uploadDocumentBinaryToStorage(projectId, `${doc.id}_audio`, audioUrl);
        if (uploaded) {
          audioUrl = uploaded;
          doc.audioUrl = uploaded;
        }
      } catch {}
    }

    const row: any = {
      id: doc.id,
      project_id: projectId,
      user_id: resolvedUserId || null,
      title: doc.title || 'Untitled Document',
      title_ta: doc.titleTa || null,
      category: doc.category || 'SCRIPT',
      file_name: doc.fileName || 'document.pdf',
      file_size: doc.fileSize || null,
      file_type: doc.fileType || 'pdf',
      page_count: doc.pageCount || 1,
      uploaded_at: doc.uploadedAt || new Date().toISOString(),
      pdf_data_url: pdfUrl,
      image_data_url: imageUrl,
      audio_url: audioUrl,
      video_url: videoUrl,
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
      original_file_data_url: originalFileUrl,
      original_file_name: doc.originalFileName || null,
      converted_docx_data_url: docxUrl,
      is_bamini_converted: !!doc.isBaminiConverted,
      is_bamini_detected: !!doc.isBaminiDetected,
      is_left_right_format: !!doc.isLeftRightFormat,
      has_two_column_script: !!doc.hasTwoColumnScript,
      two_column_data: doc.twoColumnData || null,
      left_right_doc_id: doc.leftRightDocId || null,
      source_doc_id: doc.sourceDocId || null,
      updated_at: doc.updatedAt || new Date().toISOString()
    };

    let { error } = await supabase
      .from('project_documents')
      .upsert(row, { onConflict: 'id' });

    if (error && (error.code === '42703' || error.message?.includes('column'))) {
      // In case Postgres table doesn't have the new columns yet, fallback to base columns
      const { two_column_data, has_two_column_script, is_bamini_detected, video_url, ...baseRow } = row;
      const retry = await supabase
        .from('project_documents')
        .upsert(baseRow, { onConflict: 'id' });
      error = retry.error;
    }

    if (error) {
      console.warn("Failed to upsert document with heavy binaries, retrying without large base64 strings:", error.message);
      // Strip heavy binary strings (>50KB) so document metadata, script text, sheets, and annotations are safely preserved
      const safeRow = {
        ...row,
        pdf_data_url: (pdfUrl && pdfUrl.startsWith('http')) ? pdfUrl : null,
        original_file_data_url: (originalFileUrl && originalFileUrl.startsWith('http')) ? originalFileUrl : null,
        converted_docx_data_url: (docxUrl && docxUrl.startsWith('http')) ? docxUrl : null,
        image_data_url: (imageUrl && imageUrl.startsWith('http')) ? imageUrl : null,
      };
      const retrySafe = await supabase
        .from('project_documents')
        .upsert(safeRow, { onConflict: 'id' });
      if (!retrySafe.error) {
        return true;
      }
      console.warn("Failed to upsert to project_documents table (it may not be created yet):", retrySafe.error.message);
      // Fallback: save to projects.data.documents so the other laptop gets this document!
      await saveProjectDocumentsToProjectData(projectId, [doc]);
      return true;
    }
    return true;
  } catch (err) {
    console.warn("Error saving document to Supabase:", err);
    // Attempt fallback to projects table
    try {
      await saveProjectDocumentsToProjectData(projectId, [doc]);
    } catch {}
    return false;
  }
};

/**
 * Persist an array of documents directly into the projects table JSON data (projects.data.documents).
 * This ensures that even if the public.project_documents table doesn't exist, all documents
 * are seamlessly backed up to Supabase Cloud and sync between laptops without data loss.
 */
export const saveProjectDocumentsToProjectData = async (
  projectId: string,
  docs: any[]
): Promise<boolean> => {
  if (!isSupabaseConfigured || !projectId || !docs || docs.length === 0) return false;
  try {
    const { data: projectRow, error: fetchErr } = await supabase
      .from('projects')
      .select('id, data')
      .eq('id', projectId)
      .maybeSingle();

    if (fetchErr || !projectRow) {
      console.warn('[Supabase] saveProjectDocumentsToProjectData: projectRow not found or fetch error:', fetchErr);
      return false;
    }

    // Helper to sanitize each document:
    // 1. Drop duplicate raw bytes (if pdfDataUrl exists, drop originalFileDataUrl; if image, drop camera raw originalFileDataUrl)
    // 2. Preserve compact thumbnailDataUrl (always <= 25KB WebP)
    // 3. Keep inline binaries up to 2.8MB chars (~2.1MB binary) per asset
    // 4. Strip accidental Google Accounts cookie login HTML dumps
    const sanitizeDoc = (doc: any) => {
      if (!doc) return doc;
      const clean = { ...doc };

      // Deduplicate identical copies
      if (clean.pdfDataUrl) {
        clean.originalFileDataUrl = undefined;
      }
      if (clean.fileType === 'image') {
        clean.originalFileDataUrl = undefined;
      }
      if (clean.convertedDocxDataUrl && clean.convertedDocxDataUrl === clean.originalFileDataUrl) {
        clean.originalFileDataUrl = undefined;
      }

      const MAX_INLINE_BINARY_CHARS = 2800000;
      if (clean.pdfDataUrl && !clean.pdfDataUrl.startsWith('http') && clean.pdfDataUrl.length > MAX_INLINE_BINARY_CHARS) {
        clean.pdfDataUrl = undefined;
      }
      if (clean.originalFileDataUrl && !clean.originalFileDataUrl.startsWith('http') && clean.originalFileDataUrl.length > MAX_INLINE_BINARY_CHARS) {
        clean.originalFileDataUrl = undefined;
      }
      if (clean.convertedDocxDataUrl && !clean.convertedDocxDataUrl.startsWith('http') && clean.convertedDocxDataUrl.length > MAX_INLINE_BINARY_CHARS) {
        clean.convertedDocxDataUrl = undefined;
      }
      if (clean.imageDataUrl && !clean.imageDataUrl.startsWith('http') && clean.imageDataUrl.length > 800000) {
        clean.imageDataUrl = clean.thumbnailDataUrl || undefined;
      }

      // Always ensure thumbnailDataUrl is present if imageDataUrl exists
      if (!clean.thumbnailDataUrl && clean.imageDataUrl && clean.imageDataUrl.length < 50000) {
        clean.thumbnailDataUrl = clean.imageDataUrl;
      }

      // Clean large Google login error pages in Gantt/spreadsheet htmlContent
      if (clean.htmlContent && clean.htmlContent.length > 30000 && clean.htmlContent.includes('Sign in - Google Accounts')) {
        clean.htmlContent = '<p>Production Spreadsheet Data</p>';
      }

      return clean;
    };

    const sanitizedDocs = docs.map(sanitizeDoc);

    const existingData = projectRow.data || {};
    const existingDocs: any[] = Array.isArray(existingData.documents) ? existingData.documents : [];

    // Merge incoming docs into existingDocs by ID or fileName
    const docsMap = new Map<string, any>();
    existingDocs.forEach((d) => {
      if (d && d.id) docsMap.set(d.id, sanitizeDoc(d));
    });

    sanitizedDocs.forEach((inDoc: any) => {
      if (!inDoc || !inDoc.id) return;
      const existing = docsMap.get(inDoc.id);
      if (existing) {
        docsMap.set(inDoc.id, { ...existing, ...inDoc });
      } else {
        docsMap.set(inDoc.id, inDoc);
      }
    });

    let mergedDocs = Array.from(docsMap.values());

    // If total documents JSON payload is unusually large (> 4.5MB), prune heavy data URLs from oldest docs
    let totalPayloadSize = JSON.stringify(mergedDocs).length;
    if (totalPayloadSize > 4500000) {
      console.warn(`[Supabase] Documents payload large (${(totalPayloadSize / 1024 / 1024).toFixed(1)} MB). Optimizing oldest binaries...`);
      mergedDocs = mergedDocs.map((doc, idx) => {
        // Keep thumbnailDataUrl, title, sheetData, htmlContent always
        if (idx < mergedDocs.length - 2 && doc.pdfDataUrl && doc.pdfDataUrl.length > 500000) {
          return { ...doc, pdfDataUrl: undefined };
        }
        return doc;
      });
    }

    const updatedData = {
      ...existingData,
      documents: mergedDocs,
      lastModified: Date.now()
    };

    const { error: updateErr } = await supabase
      .from('projects')
      .update({
        data: updatedData,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId);

    if (updateErr) {
      console.warn('[Supabase] Failed to update projects.data.documents fallback:', updateErr);
      return false;
    }

    console.log(`[Supabase] Successfully synced ${mergedDocs.length} documents to projects.data in cloud.`);
    return true;
  } catch (err) {
    console.warn('[Supabase] saveProjectDocumentsToProjectData exception:', err);
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
      thumbnailDataUrl: row.thumbnail_data_url || row.image_data_url || undefined,
      audioUrl: row.audio_url,
      videoUrl: row.video_url,
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
      isBaminiDetected: !!row.is_bamini_detected,
      isLeftRightFormat: !!row.is_left_right_format,
      hasTwoColumnScript: !!row.has_two_column_script,
      twoColumnData: row.two_column_data || undefined,
      leftRightDocId: row.left_right_doc_id,
      sourceDocId: row.source_doc_id,
      updatedAt: row.updated_at || row.uploaded_at
    }));
  } catch (err) {
    return null;
  }
};

/**
 * Fetch all uploaded files stored in Supabase Storage bucket 'vault-files'
 * Handles files stored in both `${projectId}/` folder and root folder.
 */
export const fetchStorageFilesFromCloud = async (projectId: string): Promise<any[]> => {
  if (!isSupabaseConfigured || !projectId) return [];
  try {
    const allFiles: { name: string; fullPath: string; metadata?: any; created_at?: string }[] = [];

    // 1. List files in projectId folder
    try {
      const { data: projectFiles, error: projErr } = await supabase.storage
        .from('vault-files')
        .list(projectId, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });

      if (!projErr && Array.isArray(projectFiles)) {
        projectFiles.forEach((f) => {
          if (f.name && !f.name.startsWith('.') && f.name !== '.emptyFolderPlaceholder') {
            allFiles.push({ ...f, fullPath: `${projectId}/${f.name}` });
          }
        });
      }
    } catch (e) {}

    // 2. Also check root directory in case files were uploaded directly to root
    try {
      const { data: rootFiles, error: rootErr } = await supabase.storage
        .from('vault-files')
        .list('', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });

      if (!rootErr && Array.isArray(rootFiles)) {
        rootFiles.forEach((f) => {
          if (f.name && !f.name.startsWith('.') && f.id && f.name.includes('.')) {
            allFiles.push({ ...f, fullPath: f.name });
          }
        });
      }
    } catch (e) {}

    if (allFiles.length === 0) return [];

    return allFiles.map((f) => {
      const { data: urlData } = supabase.storage.from('vault-files').getPublicUrl(f.fullPath);
      const publicUrl = urlData?.publicUrl || '';
      const rawName = f.name;
      // Remove leading timestamp (e.g. 1729123456_script.pdf -> script.pdf)
      const cleanName = rawName.replace(/^\d+_/, '');
      const ext = cleanName.includes('.') ? cleanName.split('.').pop()?.toLowerCase() || '' : '';
      const sizeBytes = f.metadata?.size || 0;
      const sizeStr = sizeBytes > 0 
        ? (sizeBytes < 1024 * 1024 ? `${Math.round(sizeBytes / 1024)} KB` : `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`) 
        : undefined;

      let fileType = ext;
      let category: any = 'OTHER';
      if (['pdf'].includes(ext)) {
        fileType = 'pdf';
        category = 'SCRIPT';
      } else if (['docx', 'doc', 'fountain', 'txt'].includes(ext)) {
        fileType = ext;
        category = 'SCRIPT';
      } else if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(ext)) {
        fileType = 'image';
        category = 'LOOKBOOK';
      } else if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) {
        fileType = 'audio';
        category = 'VOICE_NOTE';
      } else if (['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext)) {
        fileType = 'video';
        category = 'VIDEO';
      } else if (['xlsx', 'xls', 'csv'].includes(ext)) {
        fileType = 'sheet';
        category = 'SCHEDULE';
      }

      const title = cleanName.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');

      return {
        id: `storage-${projectId}-${f.name}`,
        projectId,
        title,
        category,
        fileName: cleanName,
        fileSize: sizeStr,
        fileType,
        pageCount: 1,
        uploadedAt: f.created_at || new Date().toISOString(),
        pdfDataUrl: fileType === 'pdf' ? publicUrl : undefined,
        imageDataUrl: fileType === 'image' ? publicUrl : undefined,
        audioUrl: fileType === 'audio' ? publicUrl : undefined,
        videoUrl: fileType === 'video' ? publicUrl : undefined,
        originalFileDataUrl: publicUrl,
        originalFileName: cleanName,
        status: 'review',
        tags: ['Supabase Storage', category],
        annotations: []
      };
    });
  } catch (err) {
    console.warn('[Supabase Storage] fetchStorageFilesFromCloud notice:', err);
    return [];
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

