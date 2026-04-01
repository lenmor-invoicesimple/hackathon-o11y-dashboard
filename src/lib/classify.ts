import type { ResourceCategory } from '../hooks/useTraceFilters';

export const classifyResource = (resource: string): ResourceCategory => {
  if (resource.includes('/checkout/')) return 'checkout';
  if (resource.includes('/_next/') || resource.includes('/public/') || resource.includes('/_not_found')) return 'nextjs';
  if (resource.includes('events.')) return 'events';
  if (resource.includes('sentry.io')) return 'sentry';
  return 'other';
};

const CATEGORY_PRIORITY: ResourceCategory[] = ['checkout', 'nextjs', 'events', 'sentry', 'other'];

export const classifyGroup = (resources: string[]): ResourceCategory => {
  const categories = new Set(resources.map(classifyResource));
  return CATEGORY_PRIORITY.find((c) => categories.has(c)) ?? 'other';
};
