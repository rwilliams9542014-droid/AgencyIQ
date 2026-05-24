/*
  # Single-Session Enforcement

  ## Purpose
  Ensures each user license has at most one active concurrent session.
  When a user logs in on a new device, the prior session token is overwritten.
  The displaced session detects the mismatch on its next heartbeat and force-logs out.

  ## New Table: active_sessions
  - id             — uuid primary key
  - user_id        — references auth.users (unique — one row per user)
  - session_token  — random UUID that identifies the current valid session
  - device_hint    — browser user-agent snippet for display/audit
  - logged_in_at   — when this session was created
  - last_seen_at   — updated every 60s by the active client (heartbeat)

  ## Security
  - RLS enabled with per-user policies
  - Users may only read/write their own row
*/

CREATE TABLE IF NOT EXISTS active_sessions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token  text NOT NULL,
  device_hint    text NOT NULL DEFAULT '',
  logged_in_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own active session"
  ON active_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own active session"
  ON active_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own active session"
  ON active_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own active session"
  ON active_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_active_sessions_user_id ON active_sessions(user_id);
