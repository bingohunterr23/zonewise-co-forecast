import type React from 'react';
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User } from '@/types';
import { authApi } from '@/services/api';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => Promise<void>;
}

// Kept on globalThis so HMR / code-split chunks always share ONE context
// instance. Two instances made <AuthProvider> in the root chunk invisible to
// consumers in a split route chunk ("useAuth must be used within AuthProvider").
const CONTEXT_KEY = "__ues_auth_context__";
const globalScope = globalThis as typeof globalThis & {
  [CONTEXT_KEY]?: React.Context<AuthContextType | undefined>;
};
const AuthContext =
  globalScope[CONTEXT_KEY] ??
  (globalScope[CONTEXT_KEY] = createContext<AuthContextType | undefined>(undefined));

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    // Remove credentials written by the previous browser-only implementation,
    // including its plain-text password store and fabricated session tokens.
    localStorage.removeItem('ues_users');
    localStorage.removeItem('ues_token');
    localStorage.removeItem('ues_user');

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ? {
        id: session.user.id,
        email: session.user.email ?? '',
        full_name: typeof session.user.user_metadata?.full_name === 'string'
          ? session.user.user_metadata.full_name
          : null,
        is_active: true,
      } : null);
      setLoading(false);
    });

    // Revalidate any persisted session with the authentication service instead
    // of trusting a browser-stored user object.
    void supabase.auth.getUser().then(({ data, error }) => {
      if (!mounted) return;
      if (!error) {
        setUser(data.user ? {
          id: data.user.id,
          email: data.user.email ?? '',
          full_name: typeof data.user.user_metadata?.full_name === 'string'
            ? data.user.user_metadata.full_name
            : null,
          is_active: true,
        } : null);
      }
      setLoading(false);
    }).catch(() => {
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setUser(await authApi.login(email, password));
  }, []);

  const signup = useCallback(async (email: string, password: string, _fullName?: string) => {
    setUser(await authApi.signup(email, password, _fullName));
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  // Never throw: a missing provider would blank the whole page. Fall back to a
  // loading-only context so the route just shows its spinner instead.
  return ctx ?? FALLBACK_CONTEXT;
}

const FALLBACK_CONTEXT: AuthContextType = {
  user: null,
  loading: true,
  login: async () => {},
  signup: async () => {},
  logout: async () => {},
};
