import { Dispatch, SetStateAction } from 'react';
import { FilterState } from '../hooks/useTraceFilters';

type StatusFilter = 'all' | 'ok' | 'error' | '4xx' | '5xx';

type DashboardHeaderProps = {
  filters: FilterState;
  setFilters: Dispatch<SetStateAction<FilterState>>;
  statusFilter: StatusFilter;
  setStatusFilter: (v: StatusFilter) => void;
  loading: boolean;
  onRefresh: () => void;
};

export const DashboardHeader = ({
  filters,
  setFilters,
  statusFilter,
  setStatusFilter,
  loading,
  onRefresh,
}: DashboardHeaderProps) => (
  <header className="flex items-center gap-4 px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
    <span className="text-gray-300 font-semibold">O11y Dashboard</span>
    <span className="text-gray-600">·</span>
    <select
      className="bg-gray-800 text-gray-200 px-2 py-0.5 rounded border border-gray-700 w-56 focus:outline-none focus:border-gray-500"
      value={filters.service}
      onChange={(e) => setFilters((f) => ({ ...f, service: e.target.value }))}
    >
      <option value="is-unifiedxp-production">is-unifiedxp-production</option>
      <option value="is-unifiedxp-staging">is-unifiedxp-staging</option>
    </select>
    <select
      className="bg-gray-800 text-gray-200 px-2 py-0.5 rounded border border-gray-700 focus:outline-none"
      value={filters.hours}
      onChange={(e) => setFilters((f) => ({ ...f, hours: e.target.value }))}
    >
      <option value="1">Last 1h</option>
      <option value="3">Last 3h</option>
      <option value="6">Last 6h</option>
      <option value="24">Last 24h</option>
    </select>
    <select
      className="bg-gray-800 text-gray-200 px-2 py-0.5 rounded border border-gray-700 focus:outline-none"
      value={statusFilter}
      onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
    >
      <option value="all">All statuses</option>
      <option value="ok">OK (2xx)</option>
      <option value="error">Error (4xx+5xx)</option>
      <option value="4xx">4xx</option>
      <option value="5xx">5xx</option>
    </select>
    <button
      onClick={onRefresh}
      disabled={loading}
      className="ml-auto px-3 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 disabled:opacity-40 transition-colors"
    >
      {loading ? 'Loading…' : 'Refresh'}
    </button>
  </header>
);
