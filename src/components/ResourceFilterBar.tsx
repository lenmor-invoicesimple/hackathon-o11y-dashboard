import { ResourceCategory, RESOURCE_CATEGORIES } from '../hooks/useTraceFilters';

type ResourceFilterBarProps = {
  allEnabled: boolean;
  enableAllCategories: () => void;
  resourceFilters: Set<ResourceCategory>;
  toggleCategory: (id: ResourceCategory) => void;
  categoryCounts: Partial<Record<ResourceCategory, number>>;
};

// Small pill that shows the trace count for a filter button.
// Active/inactive styling mirrors the parent button's selected state.
const Badge = ({ count, active }: { count: number; active: boolean }) => (
  <span className={`ml-1.5 px-1 rounded text-[10px] font-medium tabular-nums ${active ? 'bg-gray-600 text-gray-300' : 'bg-gray-800 text-gray-500'}`}>
    {count}
  </span>
);

export const ResourceFilterBar = ({
  allEnabled,
  enableAllCategories,
  resourceFilters,
  toggleCategory,
  categoryCounts,
}: ResourceFilterBarProps) => {
  // Sum counts across all categories for the "all" button badge.
  const total = Object.values(categoryCounts).reduce((sum, n) => sum + (n ?? 0), 0);

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-950 border-b border-gray-800 shrink-0">
      <span className="text-gray-600 text-xs">Show:</span>
      <button
        onClick={enableAllCategories}
        className={`px-2 py-0.5 rounded text-xs border transition-colors ${allEnabled ? 'bg-gray-700 border-gray-500 text-gray-200' : 'bg-transparent border-gray-700 text-gray-500 hover:text-gray-400'}`}
      >
        all
        {total > 0 && <Badge count={total} active={allEnabled} />}
      </button>
      {RESOURCE_CATEGORIES.map(({ id, label }) => {
        const active = resourceFilters.has(id);
        const count = categoryCounts[id] ?? 0;
        return (
          <button
            key={id}
            onClick={() => toggleCategory(id)}
            className={`px-2 py-0.5 rounded text-xs border transition-colors ${active ? 'bg-gray-700 border-gray-500 text-gray-200' : 'bg-transparent border-gray-700 text-gray-500 hover:text-gray-400'}`}
          >
            {label}
            {count > 0 && <Badge count={count} active={active} />}
          </button>
        );
      })}
    </div>
  );
};
