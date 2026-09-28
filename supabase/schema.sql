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
