// No "Closed" tab: closed setups never reach the normal UI at all (see
// selectVisibleSetups), so there's nothing for such a tab to filter to.
export type SetupFilterValue = 'all' | 'long' | 'short';

const FILTERS: { value: SetupFilterValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'long', label: 'LONG' },
  { value: 'short', label: 'SHORT' },
];

interface SetupFilterTabsProps {
  value: SetupFilterValue;
  onChange: (value: SetupFilterValue) => void;
}

export function SetupFilterTabs({ value, onChange }: SetupFilterTabsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {FILTERS.map((filter) => (
        <button
          key={filter.value}
          type="button"
          onClick={() => onChange(filter.value)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            value === filter.value
              ? 'bg-sky-500/15 text-sky-400 ring-1 ring-inset ring-sky-500/30'
              : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
          }`}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}
