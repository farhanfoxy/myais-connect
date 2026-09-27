'use client';

import { ShieldX } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { BrandMark } from '@/components/brand-mark';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';

export default function AccessDeniedPage() {
  const router = useRouter();
  const { state, logout } = useAuth();
  const email = state.status === 'access-denied' ? state.user?.email : undefined;
  return (
    <main className="centered-state-page">
      <div className="centered-state-card access-card">
        <BrandMark />
        <span className="state-icon state-icon-warning"><ShieldX /></span>
        <p className="state-eyebrow">Access unavailable</p>
        <h1>This account cannot enter the workspace</h1>
        <p>{email ? <>The canonical MyAIS account for <strong>{email}</strong> is not currently eligible for access.</> :
          'Your canonical MyAIS account is not active or does not have a recognized role.'}</p>
        <p className="state-note">Signing in does not reactivate suspended, disabled or migrated accounts. Contact the MyAIS secretariat if you believe this is incorrect.</p>
        <Button className="button-full" onClick={() => void logout().then(() => router.replace('/login'))}>Sign out</Button>
        <a href="mailto:secretariat@myais.org.my" className="text-link">Contact the secretariat</a>
      </div>
    </main>
  );
}
