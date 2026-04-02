import { useState } from 'react';

export type FilterState = {
  service: string;
  hours: string;
};

export type ResourceCategory = 'checkout' | 'report' | 'landing' | 'auth' | 'nextjs' | 'sentry' | 'other';

export const RESOURCE_CATEGORIES: { id: ResourceCategory; label: string }[] = [
  { id: 'checkout', label: 'Checkout' },
  { id: 'report',   label: 'Reports' },
  { id: 'landing',  label: 'Landing' },
  { id: 'auth',     label: 'Auth' },
  { id: 'nextjs',   label: 'Next.js' },
  { id: 'sentry',   label: 'Sentry' },
  { id: 'other',    label: 'Other' },
];

// Manages the three filter dimensions shown in the dashboard header and filter bar:
//   filters       — service + time-range (triggers a fresh API fetch)
//   statusFilter  — client-side HTTP status filter applied to already-fetched spans
//   resourceFilters — client-side category filter (checkout, report, auth, …)
export const useTraceFilters = () => {
  const [filters, setFilters] = useState<FilterState>({
    service: 'is-unifiedxp-production',
    hours: '1',
  });
  const [statusFilter, setStatusFilter] = useState<'all' | 'ok' | 'error' | '4xx' | '5xx'>('all');
  // Default to showing only checkout traces to keep the initial view focused.
  const [resourceFilters, setResourceFilters] = useState<Set<ResourceCategory>>(new Set(['checkout']));

  const allCategories = RESOURCE_CATEGORIES.map((c) => c.id);
  // True only when every category is individually selected.
  const allEnabled = allCategories.every((id) => resourceFilters.has(id));

  const toggleCategory = (id: ResourceCategory) => {
    setResourceFilters((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Clicking "all" when everything is already active clears the selection (hide all), and vice versa.
  const enableAllCategories = () => setResourceFilters(allEnabled ? new Set() : new Set(allCategories));

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
