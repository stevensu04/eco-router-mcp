// Zones that usually mean "not configured" (containers, CI) rather than where the user is.
const UNINFORMATIVE_ZONES = new Set(["UTC", "Etc/UTC", "Etc/GMT", "GMT", "Etc/Universal", "Etc/Zulu"]);

/** The host's IANA time zone, or undefined when it is missing or looks unconfigured. */
export function detectSystemTimeZone(resolved = Intl.DateTimeFormat().resolvedOptions().timeZone): string | undefined {
  return resolved && !UNINFORMATIVE_ZONES.has(resolved) ? resolved : undefined;
}

/** Throws a readable error unless `timeZone` is a valid IANA time zone name. */
export function assertTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
  } catch {
    throw new Error(`Unknown time zone "${timeZone}". Use an IANA name such as "Australia/Brisbane" or "Europe/Berlin".`);
  }
}

/** Formats an ISO timestamp as local wall-clock time, e.g. "2026-09-17 19:00 (GMT+10)". */
export function formatLocal(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "shortOffset",
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")} (${get("timeZoneName")})`;
}
