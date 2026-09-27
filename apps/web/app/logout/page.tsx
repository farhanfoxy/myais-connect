'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BrandMark } from '@/components/brand-mark';
import { useAuth } from '@/components/auth/auth-provider';
import { Spinner } from '@/components/ui/spinner';

export default function LogoutPage() {
  const router = useRouter();
  const { logout } = useAuth();
  useEffect(() => {
    void logout().finally(() => router.replace('/login'));
  }, [logout, router]);
  return (
    <main className="centered-state-page">
      <div className="centered-state-card"><BrandMark /><Spinner className="state-spinner" /><h1>Signing you out</h1></div>
    </main>
  );
}
