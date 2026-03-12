import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://eipbeynxqwgxmqogfjxo.supabase.co'
const supabaseAnonKey = 'sb_publishable_L98JQCPX8pa9yagMnkJk2w_uuaEsld3'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const auth = supabase.auth

// Auth helpers
export async function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  })
}

export function onAuthStateChanged(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user || null)
  })
  return () => subscription.unsubscribe()
}

export async function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function createUserWithEmail(email: string, password: string) {
  return supabase.auth.signUp({ email, password })
}

export async function signOut() {
  return supabase.auth.signOut()
}

export type { Session, User } from '@supabase/supabase-js'
