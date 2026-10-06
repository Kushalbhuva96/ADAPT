export function formatPercent(value) {
  return `${Math.round(value)}%`;
}

export function statusLabel(status) {
  return status.replaceAll("_", " ");
}
