import Link from 'next/link';

/**
 * Landing page — minimal entry for Phase 0. The Phase 1 auth pages live under
 * `/login` and `/dashboard`. Phase 4+ replaces this with the live topology overview.
 */
export default function HomePage() {
  return (
    <main
      style={{
        padding: '4rem 1.5rem',
        maxWidth: '64ch',
        margin: '0 auto',
        lineHeight: 1.55,
      }}
    >
      <h1 style={{ fontSize: '2.2rem', marginBottom: '0.4rem' }}>CLOUD</h1>
      <p style={{ marginTop: 0, marginBottom: '2rem', opacity: 0.8 }}>
        Cloud Infrastructure Control Plane — open source platform for managing,
        automating and observing cloud, containers, Kubernetes and on-prem
        infrastructure in a single operational layer.
      </p>
      <p>
        <Link
          href="/login"
          style={{ color: '#7ab7ff', textDecoration: 'none', fontWeight: 600 }}
        >
          Sign in →
        </Link>
      </p>
      <p style={{ opacity: 0.6, fontSize: '0.92rem' }}>
        Phase 0–1 foundation. The full topology, FinOps, security, IaC and
        automation surfaces land in Phases 2–12. See{' '}
        <code>IMPLEMENTATION_STATUS.md</code>.
      </p>
    </main>
  );
}