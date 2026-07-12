export function Header() {
  return (
    <header className="border-b border-slate-800">
      <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-sky-500/15 text-sm font-bold text-sky-400">
              M
            </span>
            <span className="text-base font-semibold text-slate-100">Market Intel</span>
          </div>
          <span className="rounded-md border border-slate-700 px-2 py-1 text-[11px] font-medium text-slate-400">
            Prototype · v1 · Live data + mock analyse
          </span>
        </div>
        <p className="text-xs text-slate-500">Don’t simplify the market. Make the market easier to understand.</p>
      </div>
    </header>
  );
}
