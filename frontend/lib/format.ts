/**
 * Format an ISO datetime string to WIB (UTC+7) with date and time.
 * Output: "16 Jul, 14:30 WIB"
 */
export function formatEtaWIB(isoString: string | null): string {
  if (!isoString) return "—";
  const date = new Date(isoString);
  return date.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }) + " WIB";
}
