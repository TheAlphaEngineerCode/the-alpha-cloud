'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

interface FormState {
  email: string;
  password: string;
  displayName: string;
  orgName: string;
  orgSlug: string;
  mode: 'login' | 'register';
  error: string | null;
  submitting: boolean;
}

const INITIAL: FormState = {
  email: '',
  password: '',
  displayName: '',
  orgName: '',
  orgSlug: '',
  mode: 'login',
  error: null,
  submitting: false,
};

export default function LoginPage() {
  const router = useRouter();
  const [state, setState] = useState<FormState>(INITIAL);

  const onChange = (field: keyof FormState, value: string) =>
    setState((s) => ({ ...s, [field]: value, error: null }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitForm();
  };

  const submitForm = async () => {
    setState((s) => ({ ...s, submitting: true, error: null }));
    try {
      const payload =
        state.mode === 'login'
          ? { email: state.email, password: state.password }
          : {
              email: state.email,
              password: state.password,
              displayName: state.displayName,
              orgName: state.orgName,
              orgSlug: state.orgSlug,
            };
      const res = await fetch(`${API_URL}/auth/${state.mode}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `request failed: ${res.status}`);
      }
      router.push('/dashboard');
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : 'network error',
        submitting: false,
      }));
    }
  };

  return (
    <main
      style={{
        padding: '4rem 1.5rem',
        maxWidth: '32rem',
        margin: '0 auto',
        lineHeight: 1.55,
      }}
    >
      <h1 style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}>The Alpha Cloud</h1>
      <p style={{ marginTop: 0, marginBottom: '2rem', opacity: 0.7 }}>
        {state.mode === 'login'
          ? 'Sign in to your operator console'
          : 'Create an organization and become its OWNER'}
      </p>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        {state.mode === 'register' && (
          <>
            <Field
              label="Display name"
              value={state.displayName}
              onChange={(v) => onChange('displayName', v)}
              autoComplete="name"
            />
            <Field
              label="Organization name"
              value={state.orgName}
              onChange={(v) => onChange('orgName', v)}
            />
            <Field
              label="Organization slug"
              value={state.orgSlug}
              onChange={(v) => onChange('orgSlug', v)}
              hint="lowercase letters, digits and hyphens"
            />
          </>
        )}
        <Field
          label="Email"
          type="email"
          value={state.email}
          onChange={(v) => onChange('email', v)}
          autoComplete="email"
        />
        <Field
          label="Password"
          type="password"
          value={state.password}
          onChange={(v) => onChange('password', v)}
          autoComplete={state.mode === 'login' ? 'current-password' : 'new-password'}
          hint={state.mode === 'register' ? 'min 12 chars; lower + upper + digit' : undefined}
        />
        {state.error && (
          <div style={{ color: '#ff8080', fontSize: '0.92rem' }} role="alert">
            {state.error}
          </div>
        )}
        <button
          type="submit"
          disabled={state.submitting}
          style={{
            padding: '0.6rem 1rem',
            background: '#1a2540',
            color: '#e8edf5',
            border: '1px solid #2a3a5a',
            borderRadius: '0.35rem',
            cursor: state.submitting ? 'not-allowed' : 'pointer',
            opacity: state.submitting ? 0.6 : 1,
          }}
        >
          {state.submitting ? 'Submitting…' : state.mode === 'login' ? 'Sign in' : 'Create organization'}
        </button>
        <button
          type="button"
          onClick={() =>
            setState((s) => ({
              ...s,
              mode: s.mode === 'login' ? 'register' : 'login',
              error: null,
            }))
          }
          style={{
            background: 'transparent',
            color: '#7ab7ff',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            padding: 0,
            fontSize: '0.92rem',
          }}
        >
          {state.mode === 'login'
            ? 'No account yet? Create one →'
            : '← Already have an account? Sign in'}
        </button>
      </form>
    </main>
  );
}

interface FieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly type?: string;
  readonly autoComplete?: string;
  readonly hint?: string;
}

function Field({ label, value, onChange, type = 'text', autoComplete, hint }: FieldProps) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <span style={{ fontSize: '0.85rem', opacity: 0.85 }}>{label}</span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        required
        style={{
          padding: '0.55rem 0.7rem',
          background: '#0b1020',
          color: '#e8edf5',
          border: '1px solid #2a3a5a',
          borderRadius: '0.35rem',
          fontFamily: 'inherit',
          fontSize: '0.95rem',
        }}
      />
      {hint && (
        <span style={{ fontSize: '0.78rem', opacity: 0.65 }}>{hint}</span>
      )}
    </label>
  );
}