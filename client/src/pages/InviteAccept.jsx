import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import api from '@/lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import logo from '@/assets/logo.png';

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
            <Loader2 className="h-8 w-8 animate-spin text-[#0066CC]" />
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
                    <p className="text-sm">{error}</p>
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
                <Link to="/login" className="text-[#0066CC] hover:underline">Log in</Link>
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
