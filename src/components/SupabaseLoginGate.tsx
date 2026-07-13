import { useState, type ReactNode } from 'react';
import { Loader2, Cloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSupabaseAuth } from '@/hooks/use-supabase-auth';

/**
 * Membungkus halaman yang datanya sudah dipindah ke Supabase (data bersama
 * multi-device). Kalau device ini belum login, tampilkan form login sekali —
 * setelah itu session tersimpan otomatis di browser (tidak perlu login lagi).
 */
export default function SupabaseLoginGate({ children }: { children: ReactNode }) {
  const { session, loading, signIn } = useSupabaseAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      setError(null);
      const { error: err } = await signIn(email.trim(), password);
      if (err) setError(err);
      setSubmitting(false);
    };

    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <Cloud className="w-8 h-8 text-primary mb-3" />
        <h2 className="text-base font-bold mb-1">Login Data Bersama</h2>
        <p className="text-xs text-muted-foreground text-center mb-5 max-w-xs">
          Halaman ini datanya dibagikan ke semua perangkat. Login sekali di perangkat ini untuk lanjut.
        </p>
        <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-3">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="h-11" />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" className="w-full h-11" disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Login'}
          </Button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
