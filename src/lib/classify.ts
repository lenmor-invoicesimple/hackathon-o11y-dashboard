import type { ResourceCategory } from '../hooks/useTraceFilters';

// Datadog resource_name often includes the HTTP method prefix (e.g. "GET /auth")
const normalizePath = (resource: string) => resource.replace(/^[A-Z]+\s+/, '');

// Maps a single Datadog resource_name to a UI category for filtering.
// Order of checks matters — more specific paths first to avoid false matches.
export const classifyResource = (resource: string): ResourceCategory => {
  const path = normalizePath(resource);
  if (path.includes('/checkout/')) return 'checkout';
  if (path.includes('/report/')) return 'report';
  if (path === '/auth' || path.startsWith('/api/auth/')) return 'auth';
  if (path.startsWith('/(') || path === '/') return 'landing'; // Next.js route groups e.g. /(authenticated)
  if (
    path.includes('/_next/') ||
    path.includes('/public/') ||
    path.includes('/_not_found')
  ) return 'nextjs';
  if (
    path.includes('sentry.io') ||
    path === '/monitoring' ||          // Sentry tunnel route (Next.js SDK)
    path.includes('/envelope/')        // Direct Sentry ingest
  ) return 'sentry';
  return 'other';
};

// Priority order used to assign a single representative category to a trace group
// that spans multiple resource types. The leftmost matching category wins.
// e.g. a group with both 'checkout' and 'nextjs' spans → 'checkout'
const CATEGORY_PRIORITY: ResourceCategory[] = ['checkout', 'report', 'landing', 'auth', 'nextjs', 'sentry', 'other'];

// Returns the highest-priority category present among all resources in a group.
export const classifyGroup = (resources: string[]): ResourceCategory => {
  const categories = new Set(resources.map(classifyResource));
  return CATEGORY_PRIORITY.find((c) => categories.has(c)) ?? 'other';
};
