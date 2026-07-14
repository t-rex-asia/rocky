import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { PermissionKey } from '@/lib/db';
import { supabase, mapUserRow, type SupabaseUser } from '@/lib/supabase';
import { useStoreSettings } from '@/hooks/use-store-settings';
import {
  hasPermission as checkPermission,
  restoreSession,
  saveSession as persistSession,
  clearSession as clearStoredSession,
  login as authLogin,
  type LoginResult,
} from '@/lib/auth';

interface AuthContextValue {
  // Whether multi-user mode is active. When false, app behaves like before
  // (single-user / legacy mode) — `currentUser` is null and `can()` always returns true.
  multiUserEnabled: boolean;
  // Whether we're still loading session/settings on first paint.
  loading: boolean;
  // Logged-in user, or null when in legacy mode or not yet logged in.
  currentUser: SupabaseUser | null;
  // Permission check: returns true in legacy mode, otherwise checks user perms.
  can: (key: PermissionKey) => boolean;
  // Owner-only flag (manage users, toggle multi-user, etc.)
  isOwner: boolean;
  login: (username: string, pin: string) => Promise<LoginResult>;
  logout: () => void;
  // Refresh currentUser from DB (e.g. after permission changes).
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Interval untuk mengecek ulang status user yang sedang login (deteksi akun
// dinonaktifkan dari device lain). Bukan realtime (users_public adalah view,
// Supabase Realtime tidak mendukung view) — cukup polling ringan.
const REFRESH_INTERVAL_MS = 60_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const { settings: storeSettings, loading: storeSettingsLoading } = useStoreSettings();
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [sessionRestored, setSessionRestored] = useState(false);

  const multiUserEnabled = !!storeSettings?.multiUserEnabled;

  // Restore session on mount (only matters if multi-user is on).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const user = await restoreSession();
      if (!cancelled) {
        setCurrentUser(user);
        setSessionRestored(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!currentUser?.id) return;
    const { data, error } = await supabase.from('users_public').select('*').eq('id', currentUser.id).maybeSingle();
    if (error || !data) return;
    const fresh = mapUserRow(data);
    if (!fresh.isActive) {
      clearStoredSession();
      setCurrentUser(null);
      return;
    }
    setCurrentUser(fresh);
  }, [currentUser?.id]);

  // Periodically re-check the logged-in user's status (deactivation/permission changes).
  useEffect(() => {
    if (!currentUser?.id) return;
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [currentUser?.id, refresh]);

  const login = useCallback(async (username: string, pin: string): Promise<LoginResult> => {
    const result = await authLogin(username, pin);
    if (result.ok && result.user?.id) {
      persistSession(result.user.id);
      setCurrentUser(result.user);
    }
    return result;
  }, []);

  const logout = useCallback(() => {
    clearStoredSession();
    setCurrentUser(null);
  }, []);

  const can = useCallback(
    (key: PermissionKey): boolean => {
      // Legacy / single-user mode: everything is allowed (backwards compatible).
      if (!multiUserEnabled) return true;
      return checkPermission(currentUser, key);
    },
    [multiUserEnabled, currentUser]
  );

  const isOwner = !multiUserEnabled || currentUser?.role === 'owner';

  // Loading: still waiting on storeSettings or first session restore attempt.
  const loading = storeSettingsLoading || !sessionRestored;

  const value: AuthContextValue = {
    multiUserEnabled,
    loading,
    currentUser,
    can,
    isOwner,
    login,
    logout,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
