const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

export function nowIso(): string {
  return new Date().toISOString();
}

export function isStrictIso(value: string): boolean {
  return ISO_UTC.test(value) && !Number.isNaN(Date.parse(value));
}

export function toPromptTimestamp(iso: string): string {
  return iso.replace(/\.\d+Z$/, "Z");
}

const IST_ZONE = "Asia/Kolkata";

export function formatIst(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: IST_ZONE,
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.weekday}, ${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute} ${parts.dayPeriod} IST`;
}
