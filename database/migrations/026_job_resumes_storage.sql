-- Migration 026: Persistent storage for job seeker resumes in PostgreSQL
-- Resolves read-only serverless filesystem limitations on Vercel/Lambda environments.

CREATE TABLE IF NOT EXISTS public.job_resumes (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  mime VARCHAR(100) NOT NULL,
  size INTEGER NOT NULL,
  file_data BYTEA NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_job_resumes_user_id ON public.job_resumes (user_id, created_at DESC);

