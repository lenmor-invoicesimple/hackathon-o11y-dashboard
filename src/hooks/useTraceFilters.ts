import { useState } from 'react';

export type FilterState = {
  service: string;
  hours: string;
};

export type ResourceCategory = 'checkout' | 'nextjs' | 'events' | 'sentry' | 'other';

export const RESOURCE_CATEGORIES: { id: ResourceCategory; label: string }[] = [
  { id: 'checkout', label: 'Checkout' },
  { id: 'nextjs',   label: 'Next.js' },
  { id: 'events',   label: 'Events' },
  { id: 'sentry',   label: 'Sentry' },
  { id: 'other',    label: 'Other' },
];

export const useTraceFilters = () => {
  const [filters, setFilters] = useState<FilterState>({
    service: 'is-unifiedxp-production',
    hours: '1',
  });
  const [statusFilter, setStatusFilter] = useState<'all' | 'ok' | 'error' | '4xx' | '5xx'>('all');
  const [resourceFilters, setResourceFilters] = useState<Set<ResourceCategory>>(new Set(['checkout']));

  const allCategories = RESOURCE_CATEGORIES.map((c) => c.id);
  const allEnabled = allCategories.every((id) => resourceFilters.has(id));

  const toggleCategory = (id: ResourceCategory) => {
    setResourceFilters((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const enableAllCategories = () => setResourceFilters(new Set(allCategories));

  return {
    filters,
    setFilters,
    statusFilter,
    setStatusFilter,
    resourceFilters,
    allCategories,
    allEnabled,
    toggleCategory,
    enableAllCategories,
  };
};
