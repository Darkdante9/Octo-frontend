import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { proxy } from './proxy';

const ORIGINAL_ENV = { ...process.env };

function makeRequest(url = 'https://octo.example.com/', headers: Record<string, string> = {}) {
  return new NextRequest(url, { headers });
}

function getCsp(res: Response): string {
  return res.headers.get('content-security-policy') ?? '';
}

function getDirective(csp: string, name: string): string | null {
  const parts = csp.split(';').map((p) => p.trim());
  for (const part of parts) {
    if (part === name || part.startsWith(`${name} `)) {
      return part;
    }
  }
  return null;
}

describe('proxy CSP reporting configuration', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.CSP_REPORT_ENDPOINT;
    delete process.env.CSP_REPORT_URI;
    delete process.env.CSP_REPORT_TO;
    delete process.env.NEXT_PUBLIC_CSP_REPORT_URI;
    delete process.env.VERCEL_ENV;
    delete (process.env as Record<string, string | undefined>).NODE_ENV;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('includes report-uri and Reporting-Endpoints when the documented variable is a valid URL', async () => {
    process.env.CSP_REPORT_ENDPOINT = 'https://reports.example.com/csp';

    const res = await proxy(makeRequest());
    const csp = getCsp(res);

    const reportUri = getDirective(csp, 'report-uri');
    expect(reportUri).not.toBeNull();
    expect(reportUri).toContain('https://reports.example.com/csp');

    const reportingEndpoints = res.headers.get('reporting-endpoints');
    expect(reportingEndpoints).not.toBeNull();
    expect(reportingEndpoints).toContain('https://reports.example.com/csp');
  });

  it('omits reporting directives when the variable is unset', async () => {
    const res = await proxy(makeRequest());
    const csp = getCsp(res);

    expect(getDirective(csp, 'report-uri')).toBeNull();
    expect(getDirective(csp, 'report-to')).toBeNull();
    expect(res.headers.get('reporting-endpoints')).toBeNull();
  });

  it('omits reporting directives when the variable is empty', async () => {
    process.env.CSP_REPORT_ENDPOINT = '';

    const res = await proxy(makeRequest());
    const csp = getCsp(res);

    expect(getDirective(csp, 'report-uri')).toBeNull();
    expect(getDirective(csp, 'report-to')).toBeNull();
    expect(res.headers.get('reporting-endpoints')).toBeNull();
  });

  it('omits reporting directives when the variable is whitespace-only', async () => {
    process.env.CSP_REPORT_ENDPOINT = '   ';

    const res = await proxy(makeRequest());
    const csp = getCsp(res);

    expect(getDirective(csp, 'report-uri')).toBeNull();
    expect(getDirective(csp, 'report-to')).toBeNull();
    expect(res.headers.get('reporting-endpoints')).toBeNull();
  });

  it('omits reporting directives when the variable is a relative URL', async () => {
    process.env.CSP_REPORT_ENDPOINT = '/csp-report';

    const res = await proxy(makeRequest());
    const csp = getCsp(res);

    expect(getDirective(csp, 'report-uri')).toBeNull();
    expect(getDirective(csp, 'report-to')).toBeNull();
    expect(res.headers.get('reporting-endpoints')).toBeNull();
  });

  it('omits reporting directives for non-http(s) URLs', async () => {
    process.env.CSP_REPORT_ENDPOINT = 'ftp://reports.example.com/csp';

    const res = await proxy(makeRequest());
    const csp = getCsp(res);

    expect(getDirective(csp, 'report-uri')).toBeNull();
    expect(getDirective(csp, 'report-to')).toBeNull();
    expect(res.headers.get('reporting-endpoints')).toBeNull();
  });
});

describe('proxy HSTS policy per environment', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.CSP_REPORT_ENDPOINT;
    delete process.env.VERCEL_ENV;
    delete process.env.OCTO_DEPLOY_ENV;
    delete (process.env as Record<string, string | undefined>).NODE_ENV;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('applies a strict HSTS policy in production', async () => {
    process.env.VERCEL_ENV = 'production';

    const res = await proxy(makeRequest());
    const hsts = res.headers.get('strict-transport-security');

    expect(hsts).not.toBeNull();
    expect(hsts).toContain('max-age=63072000');
    expect(hsts).toContain('includeSubDomains');
    expect(hsts).toContain('preload');
  });

  it('applies a relaxed HSTS policy in preview', async () => {
    process.env.VERCEL_ENV = 'preview';

    const res = await proxy(makeRequest());
    const hsts = res.headers.get('strict-transport-security');

    expect(hsts).not.toBeNull();
    expect(hsts).toContain('max-age=300');
    expect(hsts).not.toContain('preload');
    expect(hsts).not.toContain('includeSubDomains');
  });

  it('applies a relaxed HSTS policy in staging', async () => {
    process.env.VERCEL_ENV = 'staging';

    const res = await proxy(makeRequest());
    const hsts = res.headers.get('strict-transport-security');

    expect(hsts).not.toBeNull();
    expect(hsts).toContain('max-age=300');
    expect(hsts).not.toContain('preload');
    expect(hsts).not.toContain('includeSubDomains');
  });

  it('omits HSTS in development', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';

    const res = await proxy(makeRequest());
    const hsts = res.headers.get('strict-transport-security');

    expect(hsts).toBeNull();
  });

  it('falls back to the short HSTS policy for an unknown environment in a production build', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.VERCEL_ENV = 'some-unknown-env';

    const res = await proxy(makeRequest());
    const hsts = res.headers.get('strict-transport-security');

    expect(hsts).not.toBeNull();
    expect(hsts).toContain('max-age=300');
    expect(hsts).not.toContain('preload');
    expect(hsts).not.toContain('includeSubDomains');
  });
});

describe('proxy inline theme script allowance', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.CSP_REPORT_ENDPOINT;
    delete process.env.VERCEL_ENV;
    delete (process.env as Record<string, string | undefined>).NODE_ENV;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('allows the inline theme script via a hash and not a nonce on strict routes', async () => {
    const res = await proxy(makeRequest('https://octo.example.com/dashboard'));
    const csp = getCsp(res);

    const scriptSrc = getDirective(csp, 'script-src');
    expect(scriptSrc).not.toBeNull();

    expect(scriptSrc).toContain("'sha256-");
    expect(scriptSrc).not.toContain("'nonce-");
  });

  it('keeps unsafe-inline without the hash on static routes', async () => {
    // Static routes keep 'unsafe-inline' without the hash so Next's inline hydration scripts are not blocked.
    const res = await proxy(makeRequest('https://octo.example.com/'));
    const csp = getCsp(res);

    const scriptSrc = getDirective(csp, 'script-src');
    expect(scriptSrc).not.toBeNull();

    expect(scriptSrc).toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'sha256-");
  });

  it('does not emit a nonce-based allowance on the response', async () => {
    const res = await proxy(makeRequest());
    const csp = getCsp(res);

    expect(csp).not.toMatch(/'nonce-[^']+'/);
  });
});

describe('proxy CSP route classification', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.CSP_REPORT_ENDPOINT;
    delete process.env.CSP_REPORT_URI;
    delete process.env.CSP_REPORT_TO;
    delete process.env.NEXT_PUBLIC_CSP_REPORT_URI;
    delete process.env.VERCEL_ENV;
    delete (process.env as Record<string, string | undefined>).NODE_ENV;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  function isStrict(csp: string): boolean {
    const scriptSrc = getDirective(csp, 'script-src');
    return scriptSrc !== null
      ? scriptSrc.includes("'nonce-") && scriptSrc.includes("'strict-dynamic'") &&
          !scriptSrc.includes("'unsafe-inline'")
      : false;
  }

  function isLight(csp: string): boolean {
    const scriptSrc = getDirective(csp, 'script-src');
    return scriptSrc !== null
      ? scriptSrc.includes("'unsafe-inline'") && !scriptSrc.includes("'nonce-")
      : false;
  }

  it('applies the strict nonce-based CSP to login', async () => {
    const res = await proxy(makeRequest('https://octo.example.com/login'));
    expect(isStrict(getCsp(res))).toBe(true);
  });

  it('applies the strict nonce-based CSP to signup', async () => {
    const res = await proxy(makeRequest('https://octo.example.com/signup'));
    expect(isStrict(getCsp(res))).toBe(true);
  });

  it('applies the strict nonce-based CSP to forgot-password', async () => {
    const res = await proxy(
      makeRequest('https://octo.example.com/forgot-password'),
    );
    expect(isStrict(getCsp(res))).toBe(true);
  });

  it('applies the strict nonce-based CSP to dashboard routes', async () => {
    const res = await proxy(
      makeRequest('https://octo.example.com/dashboard/wallets/1'),
    );
    expect(isStrict(getCsp(res))).toBe(true);
  });

  it('applies the strict nonce-based CSP to the public checkout', async () => {
    const res = await proxy(makeRequest('https://octo.example.com/pay/abc'));
    expect(isStrict(getCsp(res))).toBe(true);
  });

  it('applies the lighter CSP to the home page (no nonce)', async () => {
    const res = await proxy(makeRequest('https://octo.example.com/'));
    expect(isLight(getCsp(res))).toBe(true);
  });

  it('applies the lighter CSP to docs pages (no nonce)', async () => {
    const res = await proxy(
      makeRequest('https://octo.example.com/docs/api/reads'),
    );
    expect(isLight(getCsp(res))).toBe(true);
  });

  it('applies the lighter CSP to privacy/terms pages (no nonce)', async () => {
    const res = await proxy(makeRequest('https://octo.example.com/privacy'));
    expect(isLight(getCsp(res))).toBe(true);
  });
});