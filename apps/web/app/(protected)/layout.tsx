import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';
import { ProtectedRoute } from '@/components/protected-route';

export default function ProtectedLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <ProtectedRoute><AppShell>{children}</AppShell></ProtectedRoute>;
}
