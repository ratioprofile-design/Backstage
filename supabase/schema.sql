-- ==============================================================================
-- Backstage Story Sequencer & Studio Production Hub
-- Supabase PostgreSQL Schema & Security Policies
-- ==============================================================================

-- 1. Create Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Untitled Project',
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for fast user project queries
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON public.projects(updated_at DESC);

-- Enable Row Level Security (RLS) on projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Projects RLS Policies
DROP POLICY IF EXISTS "Users can view own projects and invited projects" ON public.projects;
CREATE POLICY "Users can view own projects and invited projects"
    ON public.projects FOR SELECT
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM public.project_invites
            WHERE project_invites.project_id = projects.id
            AND lower(project_invites.invitee_email) = lower(auth.jwt() ->> 'email')
        )
    );

DROP POLICY IF EXISTS "Users can insert their own projects" ON public.projects;
CREATE POLICY "Users can insert their own projects"
    ON public.projects FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own projects or invited projects" ON public.projects;
CREATE POLICY "Users can update their own projects or invited projects"
    ON public.projects FOR UPDATE
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM public.project_invites
            WHERE project_invites.project_id = projects.id
            AND lower(project_invites.invitee_email) = lower(auth.jwt() ->> 'email')
        )
    );

DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;
CREATE POLICY "Users can delete their own projects"
    ON public.projects FOR DELETE
    USING (auth.uid() = user_id);

-- 2. Create Project Invites Table
CREATE TABLE IF NOT EXISTS public.project_invites (
    id BIGSERIAL PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    project_name TEXT NOT NULL DEFAULT 'Project',
    invitee_email TEXT NOT NULL,
    invited_by TEXT DEFAULT 'Collaborator',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_invites_email ON public.project_invites(lower(invitee_email));
CREATE INDEX IF NOT EXISTS idx_project_invites_project ON public.project_invites(project_id);

-- Enable RLS on project_invites
ALTER TABLE public.project_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view invites sent to their email or for their projects" ON public.project_invites;
CREATE POLICY "Users can view invites sent to their email or for their projects"
    ON public.project_invites FOR SELECT
    USING (
        lower(invitee_email) = lower(auth.jwt() ->> 'email')
        OR EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = project_invites.project_id
            AND projects.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Project owners can create invites" ON public.project_invites;
CREATE POLICY "Project owners can create invites"
    ON public.project_invites FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = project_invites.project_id
            AND projects.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Project owners or invitees can delete invites" ON public.project_invites;
CREATE POLICY "Project owners or invitees can delete invites"
    ON public.project_invites FOR DELETE
    USING (
        lower(invitee_email) = lower(auth.jwt() ->> 'email')
        OR EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = project_invites.project_id
            AND projects.user_id = auth.uid()
        )
    );

-- ==============================================================================
-- 3. Create Project Documents & Vault Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.project_documents (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    title_ta TEXT,
    category TEXT NOT NULL DEFAULT 'SCRIPT',
    file_name TEXT NOT NULL,
    file_size TEXT,
    file_type TEXT,
    page_count INT DEFAULT 1,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    pdf_data_url TEXT,
    image_data_url TEXT,
    audio_url TEXT,
    duration_seconds NUMERIC,
    html_content TEXT,
    text_content TEXT,
    sheet_data JSONB,
    built_in_type TEXT,
    annotations JSONB DEFAULT '[]'::jsonb,
    author TEXT DEFAULT 'Production Member',
    is_archived BOOLEAN DEFAULT false,
    archived_at TIMESTAMP WITH TIME ZONE,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    status TEXT DEFAULT 'review',
    original_file_data_url TEXT,
    original_file_name TEXT,
    converted_docx_data_url TEXT,
    is_bamini_converted BOOLEAN DEFAULT false,
    is_left_right_format BOOLEAN DEFAULT false,
    left_right_doc_id TEXT,
    source_doc_id TEXT,
    storage_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_documents_project_id ON public.project_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_project_documents_uploaded_at ON public.project_documents(uploaded_at DESC);

-- Enable RLS on project_documents
ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view documents of own or invited projects" ON public.project_documents;
CREATE POLICY "Users can view documents of own or invited projects"
    ON public.project_documents FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = project_documents.project_id
            AND (
                projects.user_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.project_invites
                    WHERE project_invites.project_id = projects.id
                    AND lower(project_invites.invitee_email) = lower(auth.jwt() ->> 'email')
                )
            )
        )
    );

DROP POLICY IF EXISTS "Users can insert documents into own or invited projects" ON public.project_documents;
CREATE POLICY "Users can insert documents into own or invited projects"
    ON public.project_documents FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = project_documents.project_id
            AND (
                projects.user_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.project_invites
                    WHERE project_invites.project_id = projects.id
                    AND lower(project_invites.invitee_email) = lower(auth.jwt() ->> 'email')
                )
            )
        )
    );

DROP POLICY IF EXISTS "Users can update documents in own or invited projects" ON public.project_documents;
CREATE POLICY "Users can update documents in own or invited projects"
    ON public.project_documents FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = project_documents.project_id
            AND (
                projects.user_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.project_invites
                    WHERE project_invites.project_id = projects.id
                    AND lower(project_invites.invitee_email) = lower(auth.jwt() ->> 'email')
                )
            )
        )
    );

DROP POLICY IF EXISTS "Users can delete documents in own or invited projects" ON public.project_documents;
CREATE POLICY "Users can delete documents in own or invited projects"
    ON public.project_documents FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = project_documents.project_id
            AND (
                projects.user_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.project_invites
                    WHERE project_invites.project_id = projects.id
                    AND lower(project_invites.invitee_email) = lower(auth.jwt() ->> 'email')
                )
            )
        )
    );

-- ==============================================================================
-- 4. Storage Bucket Configuration (Optional for large media files)
-- Run in Supabase SQL editor if using storage bucket 'vault-files'
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('vault-files', 'vault-files', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Authenticated users can upload to vault-files" ON storage.objects;
CREATE POLICY "Authenticated users can upload to vault-files"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'vault-files');

DROP POLICY IF EXISTS "Anyone can view files in vault-files" ON storage.objects;
CREATE POLICY "Anyone can view files in vault-files"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'vault-files');

