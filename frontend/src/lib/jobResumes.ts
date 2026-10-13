import { query } from "@/lib/db";

let isTableInitialized = false;

/**
 * Ensures the public.job_resumes PostgreSQL table exists.
 * Runs idempotently and caches initialization status.
 */
export async function ensureJobResumesTable(): Promise<void> {
  if (isTableInitialized) return;

  try {
    await query(`
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
    `);
    isTableInitialized = true;
  } catch (err: any) {
    console.warn("[jobResumes] ensureJobResumesTable warning:", err?.message || err);
  }
}

export interface StoredResumeRecord {
  id: string;
  userId: string;
  filename: string;
  mime: string;
  size: number;
  buffer: Buffer;
  createdAt?: string;
}

/**
 * Persists a resume file directly into PostgreSQL.
 */
export async function saveResumeToDatabase(params: {
  id: string;
  userId: string;
  filename: string;
  mime: string;
  size: number;
  buffer: Buffer;
}): Promise<boolean> {
  await ensureJobResumesTable();

  const res = await query(
    `INSERT INTO public.job_resumes (id, user_id, filename, mime, size, file_data)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO UPDATE 
     SET filename = EXCLUDED.filename,
         mime = EXCLUDED.mime,
         size = EXCLUDED.size,
         file_data = EXCLUDED.file_data`,
    [params.id, params.userId, params.filename, params.mime, params.size, params.buffer]
  );

  return (res.rowCount ?? 0) > 0;
}

/**
 * Fetches a resume file from PostgreSQL by its ID.
 */
export async function getResumeFromDatabase(id: string): Promise<StoredResumeRecord | null> {
  await ensureJobResumesTable();

  const res = await query(
    `SELECT id, user_id, filename, mime, size, file_data, created_at
     FROM public.job_resumes
     WHERE id = $1
     LIMIT 1`,
    [id]
  );

  if (!res.rows || res.rows.length === 0) {
    return null;
  }

  const row = res.rows[0];
  const buffer = Buffer.isBuffer(row.file_data)
    ? row.file_data
    : Buffer.from(row.file_data);

  return {
    id: row.id,
    userId: row.user_id,
    filename: row.filename,
    mime: row.mime,
    size: row.size,
    buffer,
    createdAt: row.created_at,
  };
}

/**
 * Fetches the latest resume file for a given user from PostgreSQL.
 */
export async function getLatestResumeByUser(userId: string): Promise<StoredResumeRecord | null> {
  await ensureJobResumesTable();

  const res = await query(
    `SELECT id, user_id, filename, mime, size, file_data, created_at
     FROM public.job_resumes
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );

  if (!res.rows || res.rows.length === 0) {
    return null;
  }

  const row = res.rows[0];
  const buffer = Buffer.isBuffer(row.file_data)
    ? row.file_data
    : Buffer.from(row.file_data);

  return {
    id: row.id,
    userId: row.user_id,
    filename: row.filename,
    mime: row.mime,
    size: row.size,
    buffer,
    createdAt: row.created_at,
  };
}
