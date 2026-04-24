import { useState, useEffect, useCallback } from 'react';
import { apiFetch, setTokens, clearTokens, getAccessToken } from '../lib/api';

export type User = {
  id: number;
  username: string;
  email: string | null;
  role: string;
  is_active: number;
  totp_enabled: number;
  email_otp_enabled: number;
  passkey_enabled: number;
  confirm_write_ops: number;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  error: string | null;
};

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: !!getAccessToken(),
    error: null,
  });

  const fetchMe = useCallback(async () => {
    try {
      const data = await apiFetch<{ user: User }>('/auth/me');
      setState({ user: data.user, loading: false, error: null });
    } catch {
      clearTokens();
      setState({ user: null, loading: false, error: null });
    }
  }, []);

  useEffect(() => {
    if (getAccessToken()) {
      fetchMe();
    }
  }, [fetchMe]);

  const login = useCallback(async (username: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await apiFetch<{
        requires2fa?: boolean;
        preAuthToken?: string;
        methods?: { totp: boolean; emailOtp: boolean; passkey: boolean };
        accessToken?: string;
        refreshToken?: string;
        user?: User;
      }>('/auth/login', { method: 'POST', body: { username, password } });

      if (data.requires2fa) {
        setState((s) => ({ ...s, loading: false }));
        return data;
      }
      if (data.accessToken && data.refreshToken && data.user) {
        setTokens(data.accessToken, data.refreshToken);
        setState({ user: data.user, loading: false, error: null });
      }
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setState((s) => ({ ...s, loading: false, error: msg }));
      throw err;
    }
  }, []);

  const verifyOtp = useCallback(async (preAuthToken: string, code: string, method: 'totp' | 'email') => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await apiFetch<{ accessToken: string; refreshToken: string; user: User }>(
        '/auth/verify-otp',
        { method: 'POST', body: { preAuthToken, code, method } }
      );
      setTokens(data.accessToken, data.refreshToken);
      setState({ user: data.user, loading: false, error: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      setState((s) => ({ ...s, loading: false, error: msg }));
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try { await apiFetch('/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    clearTokens();
    setState({ user: null, loading: false, error: null });
  }, []);

  const refreshUser = useCallback(() => fetchMe(), [fetchMe]);

  return { user: state.user, loading: state.loading, error: state.error, login, verifyOtp, logout, refreshUser };
}
