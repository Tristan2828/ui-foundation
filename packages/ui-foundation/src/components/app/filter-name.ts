// A filter select's accessible name (FilterSelect and FilterDate):
// what it filters first, so it's found by its label ("Status") whatever it
// shows, then the words shown unless they already say the label, so voice
// control can say them too. "Status" while it shows "Any status", "Status:
// Active" with a value, "Status: All reminders" for an `anyLabel` that
// doesn't say it.
export function filterName(label: string, shown: string): string {
  if (shown.startsWith(`${label}:`)) return shown
  return shown.toLowerCase().includes(label.toLowerCase()) ? label : `${label}: ${shown}`
}
