import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/components/auth/auth-provider';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'MyAIS Connect',
    template: '%s · MyAIS Connect',
  },
  description: 'The secure membership platform for the Malaysian Association for Information Systems.',
  icons: { icon: '/brand/myais-official-logo.jpg' },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
