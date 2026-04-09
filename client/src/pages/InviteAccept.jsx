import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import api from '@/lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import logo from '@/assets/logo.png';

function PasswordStrength({ password }) {
  if (!password) return null;
  let strength = 0;
  if (password.length >= 6) strength++;
  if (password.length >= 10) strength++;
  if (/[A-Z]/.test(password) && /[0-9]/.test(password)) strength++;
  const labels = ['Weak', 'Fair', 'Strong'];
  const colors = ['bg-red-500', 'bg-yellow-500', 'bg-green-500'];
  const label = strength > 0 ? labels[strength - 1] : 'Too short';
  const color = strength > 0 ? colors[strength - 1] : 'bg-red-300';
  return (
    <div className="space-y-1 mt-1.5">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < strength ? color : 'bg-[hsl(var(--muted))]'}`} />
        ))}
      </div>
      <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
    </div>
  );
}

export function InviteAccept() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [invite, setInvite] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | valid | invalid | success
  const [invalidMsg, setInvalidMsg] = useState('');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get(`/api/invitations/${token}`)
      .then(res => {
        setInvite(res.data);
        setStatus('valid');
      })
      .catch(err => {
        setInvalidMsg(err.response?.data?.error || 'Invalid invitation link');
        setStatus('invalid');
      });
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/api/invitations/${token}/accept`, { username, password });
      setStatus('success');
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create account');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--background))] p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <img src={logo} alt="Kuma" className="h-10 w-auto" />
        </div>

        {status === 'loading' && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--brand-primary)]" />
          </div>
        )}

        {status === 'invalid' && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <XCircle className="h-12 w-12 text-red-500" />
              <h2 className="text-lg font-semibold">Invitation Invalid</h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">{invalidMsg}</p>
              <Button asChild variant="outline" className="mt-2">
                <Link to="/login">Go to Login</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {status === 'success' && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <h2 className="text-lg font-semibold">Account Created!</h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Redirecting you to your dashboard…
              </p>
            </CardContent>
          </Card>
        )}

        {status === 'valid' && invite && (
          <Card>
            <CardHeader>
              <CardTitle>You're invited!</CardTitle>
              <CardDescription>
                <strong>{invite.invitedBy}</strong> invited you to join{' '}
                <strong>{invite.projectName}</strong>. Create your account to get started.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input value={invite.email} disabled className="opacity-60" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="username">Choose a Username</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="yourname"
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    required
                  />
                  <PasswordStrength password={password} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm">Confirm Password</Label>
                  <Input
                    id="confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    required
                  />
                </div>
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating account…</>
                  ) : (
                    'Create Account & Join Project'
                  )}
                </Button>
              </form>
              <p className="mt-4 text-center text-xs text-[hsl(var(--muted-foreground))]">
                Already have an account?{' '}
                <Link to="/login" className="text-[var(--brand-primary)] hover:underline">Log in</Link>
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
