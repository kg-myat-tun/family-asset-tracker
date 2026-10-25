// Calendar-date fields (transaction dates, due dates) are stored as UTC
// midnight — `new Date("YYYY-MM-DD")` from a date input — and bucketed into
// months in UTC. Format them in UTC too, or viewers west of UTC see the
// previous day. Real instants (createdAt, paidAt) keep local-time formatting.
export function formatCalendarDate(date: Date): string {
  return date.toLocaleDateString(undefined, { timeZone: "UTC" });
}
