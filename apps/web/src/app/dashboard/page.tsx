'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

interface MeResponse {
  user: { id: string; email: string; displayName: string };
  organizations: { id: string; name: string; slug: string; role: string }[];
  tenant: { organizationId: string; role: string } | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          credentials: 'include',
        });
        if (res.status === 401) {
          router.replace('/login');
          return;
        }
        if (!res.ok) throw new Error(`request failed: ${res.status}`);
        const body = (await res.json()) as MeResponse;
        if (!cancelled) setMe(body);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'network error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const onLogout = () => {
    void (async () => {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      router.replace('/login');
    })();
  };

  if (err) {
    return (
      <main style={{ padding: '4rem 1.5rem', maxWidth: '48rem', margin: '0 auto' }}>
        <p style={{ color: '#ff8080' }}>Failed to load dashboard: {err}</p>
      </main>
    );
  }

  if (!me) {
    return (
      <main style={{ padding: '4rem 1.5rem', maxWidth: '48rem', margin: '0 auto' }}>
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <main style={{ padding: '4rem 1.5rem', maxWidth: '48rem', margin: '0 auto', lineHeight: 1.55 }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
        }}
      >
        <h1 style={{ fontSize: '1.6rem', margin: 0 }}>The Alpha Cloud console</h1>
        <button
          onClick={onLogout}
          style={{
            background: 'transparent',
            color: '#7ab7ff',
            border: '1px solid #2a3a5a',
            borderRadius: '0.35rem',
            padding: '0.4rem 0.8rem',
            cursor: 'pointer',
          }}
        >
          Sign out
        </button>
      </header>

      <section style={{ marginBottom: '1.6rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.4rem' }}>Signed in as</h2>
        <p style={{ margin: 0 }}>
          {me.user.displayName} &lt;{me.user.email}&gt;
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.4rem' }}>Organizations</h2>
        {me.organizations.length === 0 ? (
          <p style={{ opacity: 0.7 }}>No organizations yet.</p>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem',
            }}
          >
            {me.organizations.map((o) => (
              <li
                key={o.id}
                style={{
                  padding: '0.7rem 1rem',
                  background: '#0e1530',
                  border: '1px solid #1a2540',
                  borderRadius: '0.45rem',
                }}
              >
                <strong>{o.name}</strong>
                <span style={{ opacity: 0.7 }}> · {o.slug}</span>
                <span style={{ marginLeft: '0.8rem', color: '#7ab7ff' }}>{o.role}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginTop: '2rem', opacity: 0.6, fontSize: '0.9rem' }}>
        <p>Phase 0–1: auth, organizations, RBAC, multi-tenant isolation, audit.</p>
        <p>
          Topology, applications, deployments, Kubernetes, observability, FinOps, security, IaC and
          automation land in Phases 2–12.
        </p>
      </section>
    </main>
  );
}
