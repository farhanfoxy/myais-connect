import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/components/auth/auth-provider';
import { ThemeProvider, themeInitializationScript } from '@/components/theme-provider';
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
      <head><script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} /></head>
      <body><ThemeProvider><AuthProvider>{children}</AuthProvider></ThemeProvider></body>
    </html>
  );
}
