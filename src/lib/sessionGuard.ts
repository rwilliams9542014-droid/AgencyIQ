import { supabase } from './supabase'

// Each browser tab gets a unique token stored in sessionStorage.
// sessionStorage survives page reloads within the same tab but NOT across tabs/windows,
// which is exactly the behavior we want for single-session enforcement.
function getOrCreateToken(): string {
  let t = sessionStorage.getItem('iq_session_token')
  if (!t) {
    t = crypto.randomUUID()
    sessionStorage.setItem('iq_session_token', t)
  }
  return t
}

// Called immediately after a successful login.
// Upserts the session row — overwrites any prior session for this user,
// which will cause the other device to be kicked on its next heartbeat.
export async function registerSession(userId: string): Promise<void> {
  const token = getOrCreateToken()
  await supabase.from('active_sessions').upsert(
    {
      user_id: userId,
      session_token: token,
      device_hint: navigator.userAgent.slice(0, 120),
      logged_in_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )
}

// Returns true if this tab still owns the active session.
export async function validateSession(userId: string): Promise<boolean> {
  const token = sessionStorage.getItem('iq_session_token')
  if (!token) return false
  const { data } = await supabase
    .from('active_sessions')
    .select('session_token')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.session_token === token
}

// Updates last_seen_at to signal this session is alive.
export async function heartbeat(userId: string): Promise<void> {
  const token = sessionStorage.getItem('iq_session_token')
  if (!token) return
  await supabase
    .from('active_sessions')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('session_token', token)
}

// Called on logout.
export async function clearSession(userId: string): Promise<void> {
  sessionStorage.removeItem('iq_session_token')
  await supabase.from('active_sessions').delete().eq('user_id', userId)
}

// Starts a 60-second heartbeat loop. Calls onKicked() if this session is no longer valid.
// Returns a cleanup function to stop the loop.
export function startHeartbeat(userId: string, onKicked: () => void): () => void {
  let active = true

  const tick = async () => {
    if (!active) return
    const valid = await validateSession(userId)
    if (!valid) { active = false; onKicked(); return }
    await heartbeat(userId)
  }

  tick() // first check immediately
  const id = setInterval(tick, 60_000)
  return () => { active = false; clearInterval(id) }
}
