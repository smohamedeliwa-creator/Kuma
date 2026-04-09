import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WeaveLogoCompact } from '@/components/WeaveLogo';

/* ── Floating task-card shown in the right panel ── */
function TaskCard() {
  const tasks = [
    {
      avatar: 'A', avatarBg: '#2EC4B6',
      badge: 'Done', badgeBg: 'rgba(46,196,182,0.2)', badgeColor: '#2EC4B6',
    },
    {
      avatar: 'J', avatarBg: '#6C47FF',
      badge: 'In progress', badgeBg: 'rgba(108,71,255,0.2)', badgeColor: '#9D7FFF',
    },
    {
      avatar: 'S', avatarBg: '#FF6B6B',
      badge: 'To do', badgeBg: 'rgba(255,255,255,0.08)', badgeColor: 'rgba(255,255,255,0.4)',
    },
  ];

  return (
    <div style={{
      width: '300px',
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(46,196,182,0.2)',
      borderRadius: '20px',
      padding: '28px',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
      animation: 'cardEntrance 1s cubic-bezier(0.22,1,0.36,1) 0.4s both',
    }}>
      {/* Card header */}
      <div style={{
        fontSize: '14px', fontWeight: 700,
        color: 'rgba(255,255,255,0.92)',
        marginBottom: '18px',
        letterSpacing: '-0.01em',
      }}>
        Q2 Product Launch
      </div>

      {/* Task rows */}
      {tasks.map((t, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '10px 12px',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: '10px',
          marginBottom: '8px',
        }}>
          {/* Avatar */}
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: t.avatarBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>{t.avatar}</div>

          {/* Placeholder bars */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ height: '8px', width: '55%', borderRadius: '4px', background: 'rgba(255,255,255,0.15)', marginBottom: '4px' }} />
            <div style={{ height: '6px', width: '35%', borderRadius: '3px', background: 'rgba(255,255,255,0.08)' }} />
          </div>

          {/* Status badge */}
          <span style={{
            fontSize: '11px', fontWeight: 600,
            background: t.badgeBg, color: t.badgeColor,
            borderRadius: '100px', padding: '4px 10px',
            flexShrink: 0, whiteSpace: 'nowrap',
          }}>{t.badge}</span>
        </div>
      ))}

      {/* Divider */}
      <div style={{ height: '1px', background: 'rgba(46,196,182,0.12)', margin: '16px 0' }} />

      {/* Progress row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
          3 of 8 tasks complete
        </span>
        <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          <div style={{ width: '37%', height: '100%', borderRadius: '2px', background: '#2EC4B6' }} />
        </div>
      </div>
    </div>
  );
}

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  if (user) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = (field) => ({
    width: '100%',
    height: '48px',
    borderRadius: '12px',
    border: focusedField === field
      ? '1.5px solid #6C47FF'
      : '1.5px solid #E5E2F0',
    background: '#FAFAFA',
    color: '#1A1A2E',
    padding: '0 16px',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border 150ms, box-shadow 150ms',
    boxShadow: focusedField === field
      ? '0 0 0 3px rgba(108,71,255,0.12)'
      : 'none',
  });

  return (
    <>
      <style>{`
        .login-page * { box-sizing: border-box; }
        .login-input::placeholder { color: #C0C0D0; font-size: 13px; }
        @keyframes orbFloat1 {
          0%,100% { transform: translate(0,0); }
          50% { transform: translate(-28px, 28px); }
        }
        @keyframes orbFloat2 {
          0%,100% { transform: translate(0,0); }
          50% { transform: translate(24px,-24px); }
        }
        @keyframes orbFloat3 {
          0%,100% { transform: translate(0,0); }
          50% { transform: translate(-16px,20px); }
        }
        @keyframes cardEntrance {
          from { opacity:0; transform: translateY(36px) scale(0.95); }
          to   { opacity:1; transform: translateY(0) scale(1); }
        }
        @keyframes fadeUp {
          from { opacity:0; transform: translateY(16px); }
          to   { opacity:1; transform: translateY(0); }
        }
        .login-field-1 { animation: fadeUp 0.6s ease-out 0.1s both; }
        .login-field-2 { animation: fadeUp 0.6s ease-out 0.2s both; }
        .login-field-3 { animation: fadeUp 0.6s ease-out 0.3s both; }
        .login-btn:hover { opacity: 0.88; }
        .login-btn:active { transform: scale(0.99); }
      `}</style>

      <div className="login-page" style={{
        display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden',
        fontFamily: 'var(--font-sans, "Plus Jakarta Sans", system-ui, sans-serif)',
      }}>

        {/* ── LEFT PANEL ── */}
        <div style={{
          flex: '0 0 45%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '56px 52px',
          background: '#FFFFFF',
          position: 'relative',
          overflowY: 'auto',
        }}
          className="login-left-panel"
        >
          {/* Logo */}
          <div style={{ marginBottom: '48px' }}>
            <WeaveLogoCompact size={34} />
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize: '32px', fontWeight: 800,
            color: '#1A1A2E', letterSpacing: '-0.025em',
            margin: '0 0 8px',
            lineHeight: 1.2,
          }}>Welcome back</h1>
          <p style={{
            fontSize: '15px', color: '#9A9AB0',
            margin: '0 0 36px', lineHeight: 1.5,
          }}>Sign in to your workspace</p>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            <div className="login-field-1" style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block', fontSize: '11px', fontWeight: 700,
                color: '#9A9AB0', letterSpacing: '0.1em',
                textTransform: 'uppercase', marginBottom: '6px',
              }}>Username</label>
              <input
                type="text"
                className="login-input"
                autoComplete="username"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onFocus={() => setFocusedField('username')}
                onBlur={() => setFocusedField(null)}
                disabled={loading}
                required
                style={inputStyle('username')}
              />
            </div>

            <div className="login-field-2" style={{ marginBottom: '0' }}>
              <label style={{
                display: 'block', fontSize: '11px', fontWeight: 700,
                color: '#9A9AB0', letterSpacing: '0.1em',
                textTransform: 'uppercase', marginBottom: '6px',
              }}>Password</label>
              <input
                type="password"
                className="login-input"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                disabled={loading}
                required
                style={inputStyle('password')}
              />
            </div>

            {error && (
              <div style={{ marginTop: '16px' }}>
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              </div>
            )}

            <div className="login-field-3" style={{ marginTop: '20px' }}>
              <button
                type="submit"
                disabled={loading}
                className="login-btn"
                style={{
                  width: '100%', height: '48px',
                  borderRadius: '12px',
                  background: '#1A1A2E',
                  color: '#FFFFFF',
                  fontSize: '15px', fontWeight: 600,
                  border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  transition: 'opacity 150ms, transform 100ms',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? (
                  <>
                    <Loader2 style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
                    Signing in…
                  </>
                ) : 'Sign In'}
              </button>
            </div>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '24px 0' }}>
            <div style={{ flex: 1, height: '1px', background: '#E5E2F0' }} />
            <span style={{ fontSize: '13px', color: '#C0C0D0' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: '#E5E2F0' }} />
          </div>

          {/* Footer */}
          <p style={{ textAlign: 'center', fontSize: '13px', color: '#9A9AB0', margin: 0 }}>
            Don't have an account?{' '}
            <span style={{ color: '#6C47FF', fontWeight: 600, cursor: 'default' }}>Create one</span>
          </p>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div
          className="login-right-panel"
          style={{
            flex: '0 0 55%',
            position: 'relative',
            overflow: 'hidden',
            background: '#0D1117',
            backgroundImage:
              'linear-gradient(rgba(46,196,182,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(46,196,182,0.06) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Orb 1 — top right, teal */}
          <div style={{
            position: 'absolute', top: '-100px', right: '-100px',
            width: '400px', height: '400px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(46,196,182,0.25) 0%, transparent 65%)',
            animation: 'orbFloat1 8s ease-in-out infinite',
            pointerEvents: 'none',
          }} />

          {/* Orb 2 — bottom left, purple */}
          <div style={{
            position: 'absolute', bottom: '-60px', left: '-60px',
            width: '300px', height: '300px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(108,71,255,0.2) 0%, transparent 65%)',
            animation: 'orbFloat2 10s ease-in-out infinite',
            pointerEvents: 'none',
          }} />

          {/* Orb 3 — center, teal faint */}
          <div style={{
            position: 'absolute', top: '45%', left: '40%',
            width: '200px', height: '200px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(46,196,182,0.12) 0%, transparent 70%)',
            animation: 'orbFloat3 6s ease-in-out infinite',
            pointerEvents: 'none',
          }} />

          {/* Task preview card */}
          <div style={{ position: 'relative', zIndex: 2 }}>
            <TaskCard />
          </div>

          {/* Bottom tagline */}
          <div style={{
            position: 'absolute', bottom: '32px', left: 0, right: 0,
            textAlign: 'center', zIndex: 2,
          }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>
              Everything you need.
            </div>
            <div style={{ fontSize: '14px', color: '#2EC4B6' }}>
              All in one place.
            </div>
          </div>
        </div>

        {/* Mobile: hide right panel */}
        <style>{`
          @media (max-width: 768px) {
            .login-right-panel { display: none !important; }
            .login-left-panel {
              flex: 0 0 100% !important;
              padding: 40px 28px !important;
            }
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </>
  );
}
