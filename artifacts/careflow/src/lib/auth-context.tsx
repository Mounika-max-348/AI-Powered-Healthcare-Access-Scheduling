import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { setAuthTokenGetter } from '@workspace/api-client-react';

export type DemoRole = 'PATIENT' | 'DOCTOR' | 'HOSPITAL_ADMIN' | 'PLATFORM_ADMIN';

export type Actor = {
  id: string;
  role: DemoRole;
  hospitalId: string | null;
  displayName: string;
};

type StoredSession = { token: string; actor: Actor };

const STORAGE_KEY = 'careflow.session';

function readStoredSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.token || !parsed?.actor?.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

type AuthContextValue = {
  actor: Actor | null;
  status: 'checking' | 'authenticated' | 'anonymous';
  loginAs: (role: DemoRole) => Promise<void>;
  logout: () => void;
  loggingIn: DemoRole | null;
  error: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(() => readStoredSession());
  const [status, setStatus] = useState<AuthContextValue['status']>(() => (readStoredSession() ? 'checking' : 'anonymous'));
  const [loggingIn, setLoggingIn] = useState<DemoRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAuthTokenGetter(() => session?.token ?? null);
  }, [session?.token]);

  // Revalidate a persisted session against the server once on load, in case
  // the server restarted and its session secret rotated.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetch('/api/auth/me', { headers: { authorization: `Bearer ${session.token}` } })
      .then((response) => {
        if (cancelled) return;
        if (!response.ok) {
          setSession(null);
          window.localStorage.removeItem(STORAGE_KEY);
          setStatus('anonymous');
          return;
        }
        setStatus('authenticated');
      })
      .catch(() => {
        if (!cancelled) setStatus('authenticated'); // stay signed in if the check itself failed offline
      });
    return () => {
      cancelled = true;
    };
    // Only re-check when the token actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  const loginAs = useCallback(async (role: DemoRole) => {
    setLoggingIn(role);
    setError(null);
    try {
      const response = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!response.ok) throw new Error('Could not start the demo session. Please try again.');
      const body = (await response.json()) as StoredSession;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(body));
      setSession(body);
      setStatus('authenticated');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start the demo session.');
    } finally {
      setLoggingIn(null);
    }
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ actor: session?.actor ?? null, status, loginAs, logout, loggingIn, error }),
    [session, status, loginAs, logout, loggingIn, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}
