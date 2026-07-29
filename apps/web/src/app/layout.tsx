import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Root layout — common chrome shared by all pages. Dark preference by default.
 * Phase 0 keeps markup minimal: a Server Component rendering children and a
 * static title; Phase 2+ adds the command palette and global navigation.
 */
export const metadata = {
  title: 'The Alpha Cloud — Cloud Infrastructure Control Plane',
  description:
    'The Alpha Cloud — open source control plane for managing, automating and observing cloud, containers, Kubernetes and on-prem infrastructure in a single operational layer.',
};

const fontStack =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif';

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body
        style={{
          margin: 0,
          background: '#0b1020',
          color: '#e8edf5',
          fontFamily: fontStack,
          minHeight: '100vh',
        }}
      >
        {children}
      </body>
    </html>
  );
}

// silence "redirect" import warning when used per-route
void redirect;
