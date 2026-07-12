export function formatUsdPrice(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  const digits = value >= 100 ? 2 : value >= 1 ? 4 : 6;
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function formatPercent(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatFundingRate(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(4)}%`;
}

export function formatCompactNumber(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value);
}

export function formatCompactUsd(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return `$${formatCompactNumber(value)}`;
}

export function formatClockTime(timestamp: number | null | undefined): string {
  if (!timestamp) return '—:—:—';
  return new Date(timestamp).toLocaleTimeString('nl-NL', { hour12: false });
}

/** Compact "11 jul 14:35" style stamp — used for the inline "⚠️ field gewijzigd" change warnings. */
export function formatChangeTimestamp(timestamp: number | null | undefined): string {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
}
