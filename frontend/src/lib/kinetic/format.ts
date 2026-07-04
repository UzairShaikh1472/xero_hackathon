export const formatMoney = (
  currency: string,
  n: number,
  opts: { signed?: boolean; compact?: boolean } = {},
) => {
  const abs = Math.abs(n);
  const formatted = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
    notation: opts.compact && abs >= 10000 ? "compact" : "standard",
  }).format(abs);
  if (opts.signed) return `${n < 0 ? "-" : "+"}${formatted}`;
  return n < 0 ? `-${formatted}` : formatted;
};

export const gbp = (n: number, opts: { signed?: boolean; compact?: boolean } = {}) =>
  formatMoney("GBP", n, opts);

export const pct = (n: number) => `${Math.round(n * 100)}%`;

export const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.max(1, Math.round(diff / 60000));
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};
