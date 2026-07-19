import { describe, it, expect } from 'vitest';
import {
  canAccess,
  resolveTier,
  checkCaseLimit,
  checkDocLimit,
  checkStorageLimit,
  checkFileSize,
} from './feature-gate';

// Minimal chainable Supabase mock. Each of these functions ends its
// chain with a plain `await`, so the last object in the chain just
// needs to be a thenable resolving to the configured result.
function mockSupabase(tableResults: Record<string, unknown>) {
  function chain(result: unknown) {
    const node: Record<string, unknown> = {
      select: () => node,
      eq: () => node,
      in: () => node,
      then: (resolve: (v: unknown) => void) => resolve(result),
    };
    return node;
  }
  return {
    from: (table: string) => chain(tableResults[table] ?? { data: null, count: 0 }),
  };
}

describe('canAccess — plan feature gates', () => {
  // These are the two gates that were previously missing entirely
  // (basic-tier users could use chat / invite lawyers for free).
  it('blocks chat for basic tier, allows it for pro/premium', () => {
    expect(canAccess('basic', 'chat')).toBe(false);
    expect(canAccess('pro', 'chat')).toBe(true);
    expect(canAccess('premium', 'chat')).toBe(true);
  });

  it('blocks lawyer_invite for basic tier, allows it for pro/premium', () => {
    expect(canAccess('basic', 'lawyer_invite')).toBe(false);
    expect(canAccess('pro', 'lawyer_invite')).toBe(true);
    expect(canAccess('premium', 'lawyer_invite')).toBe(true);
  });

  it('defaults to basic tier gates when tier is undefined/null', () => {
    expect(canAccess(undefined, 'chat')).toBe(false);
    expect(canAccess(null, 'chat')).toBe(false);
  });
});

describe('resolveTier — subscription expiry', () => {
  it('falls back to basic when the period has already ended', () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    expect(resolveTier('premium', yesterday)).toBe('basic');
  });

  it('keeps the paid tier when the period is still active', () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    expect(resolveTier('premium', tomorrow)).toBe('premium');
  });

  it('keeps the tier when no period end is given', () => {
    expect(resolveTier('pro', null)).toBe('pro');
    expect(resolveTier('pro', undefined)).toBe('pro');
  });

  it('defaults to basic when tier is missing', () => {
    expect(resolveTier(null, null)).toBe('basic');
  });
});

describe('checkCaseLimit', () => {
  it('allows creating a case when under the cap', async () => {
    const supabase = mockSupabase({ cases: { count: 2 } });
    const result = await checkCaseLimit('user-1', 'basic', supabase);
    expect(result.max).toBe(3); // basic tier cap per TIER_GATES
    expect(result.current).toBe(2);
    expect(result.allowed).toBe(true);
  });

  it('blocks creating a case once at the cap', async () => {
    const supabase = mockSupabase({ cases: { count: 3 } });
    const result = await checkCaseLimit('user-1', 'basic', supabase);
    expect(result.allowed).toBe(false);
  });
});

describe('checkDocLimit', () => {
  it('allows upload when the result stays within the per-case cap', async () => {
    const supabase = mockSupabase({ documents: { count: 4 } });
    const result = await checkDocLimit('case-1', 'basic', supabase, 1);
    expect(result.allowed).toBe(true); // 4 + 1 = 5, basic max is 5
  });

  it('blocks upload when it would exceed the per-case cap', async () => {
    const supabase = mockSupabase({ documents: { count: 5 } });
    const result = await checkDocLimit('case-1', 'basic', supabase, 1);
    expect(result.allowed).toBe(false); // 5 + 1 = 6 > 5
  });
});

describe('checkStorageLimit', () => {
  it('sums real document sizes across all of a user\'s cases', async () => {
    const supabase = mockSupabase({
      cases: { data: [{ id: 'case-1' }, { id: 'case-2' }] },
      documents: { data: [{ file_size: 100 }, { file_size: 200 }] },
    });
    const result = await checkStorageLimit('user-1', 'basic', supabase, 0);
    expect(result.bytes_used).toBe(300);
    expect(result.allowed).toBe(true);
  });

  it('blocks an upload that would push a user over their quota', async () => {
    const GB = 1_073_741_824;
    const supabase = mockSupabase({
      cases: { data: [{ id: 'case-1' }] },
      documents: { data: [{ file_size: GB - 1000 }] }, // basic cap is 1 GB
    });
    const result = await checkStorageLimit('user-1', 'basic', supabase, 5000);
    expect(result.allowed).toBe(false);
  });
});

describe('checkFileSize', () => {
  it('enforces the 50MB vault cap and 10MB AI-analysis cap separately', () => {
    const fiftyMB = 50 * 1024 * 1024;
    const tenMB = 10 * 1024 * 1024;
    expect(checkFileSize(fiftyMB, 'vault').allowed).toBe(true);
    expect(checkFileSize(fiftyMB + 1, 'vault').allowed).toBe(false);
    expect(checkFileSize(tenMB, 'ai').allowed).toBe(true);
    expect(checkFileSize(tenMB + 1, 'ai').allowed).toBe(false);
  });
});
