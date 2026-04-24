import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const { login, verifyOtp, error, loading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [requires2fa, setRequires2fa] = useState(false);
  const [preAuthToken, setPreAuthToken] = useState('');
  const [otpMethods, setOtpMethods] = useState<{ totp: boolean; emailOtp: boolean; passkey: boolean } | null>(null);
  const [otpMethod, setOtpMethod] = useState<'totp' | 'email'>('totp');
  const [otpCode, setOtpCode] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    try {
      const result = await login(username, password);
      if (result?.requires2fa && result.preAuthToken) {
        setRequires2fa(true);
        setPreAuthToken(result.preAuthToken);
        setOtpMethods(result.methods ?? null);
        if (result.methods?.emailOtp && !result.methods.totp) {
          setOtpMethod('email');
        }
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  const handleOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    try {
      await verifyOtp(preAuthToken, otpCode, otpMethod);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Verification failed');
    }
  };

  const displayError = localError ?? error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 w-full max-w-sm">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">D1Studio</h1>
          <p className="text-sm text-gray-500 mt-1">
            {requires2fa ? 'Two-factor authentication' : 'Sign in to your account'}
          </p>
        </div>

        {displayError && (
          <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-sm text-red-700">
            {displayError}
          </div>
        )}

        {!requires2fa ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter username"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter password"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleOtp} className="space-y-4">
            {otpMethods && (otpMethods.totp || otpMethods.emailOtp) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
                <select
                  value={otpMethod}
                  onChange={(e) => setOtpMethod(e.target.value as 'totp' | 'email')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {otpMethods.totp && <option value="totp">Authenticator App (TOTP)</option>}
                  {otpMethods.emailOtp && <option value="email">Email OTP</option>}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {otpMethod === 'totp' ? 'Authenticator Code' : 'Email Code'}
              </label>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono tracking-widest"
                placeholder="000000"
                required
                autoFocus
                maxLength={8}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verifying…' : 'Verify'}
            </button>
            <button
              type="button"
              onClick={() => { setRequires2fa(false); setOtpCode(''); }}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              Back to login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
