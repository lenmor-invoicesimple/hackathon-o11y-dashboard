import { ResourceCategory, RESOURCE_CATEGORIES } from '../hooks/useTraceFilters';

type ResourceFilterBarProps = {
  allEnabled: boolean;
  enableAllCategories: () => void;
  resourceFilters: Set<ResourceCategory>;
  toggleCategory: (id: ResourceCategory) => void;
};

export const ResourceFilterBar = ({
  allEnabled,
  enableAllCategories,
  resourceFilters,
  toggleCategory,
}: ResourceFilterBarProps) => (
  <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-950 border-b border-gray-800 shrink-0">
    <span className="text-gray-600 text-xs">Show:</span>
    <button
      onClick={enableAllCategories}
      className={`px-2 py-0.5 rounded text-xs border transition-colors ${allEnabled ? 'bg-gray-700 border-gray-500 text-gray-200' : 'bg-transparent border-gray-700 text-gray-500 hover:text-gray-400'}`}
    >
      all
    </button>
    {RESOURCE_CATEGORIES.map(({ id, label }) => (
      <button
        key={id}
        onClick={() => toggleCategory(id)}
        className={`px-2 py-0.5 rounded text-xs border transition-colors ${resourceFilters.has(id) ? 'bg-gray-700 border-gray-500 text-gray-200' : 'bg-transparent border-gray-700 text-gray-500 hover:text-gray-400'}`}
      >
        {label}
      </button>
    ))}
  </div>
);
