export const LOG_LEVEL_COLORS: Record<string, string> = {
  error: 'text-red-400',
  warn:  'text-yellow-400',
  info:  'text-sky-400',
  debug: 'text-gray-500',
  trace: 'text-gray-600',
};

export const STATUS_COLORS: Record<string, string> = {
  ok: 'text-emerald-400',
  error: 'text-red-400',
  warn: 'text-yellow-400',
};

export const codeColor = (code: number | null) => {
  if (!code) return 'text-gray-400';
  if (code < 400) return 'text-emerald-400';
  if (code < 500) return 'text-yellow-400';
  return 'text-red-400';
};

export const fmt = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};
