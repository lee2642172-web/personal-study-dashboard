/** Display-only 90-minute rows; never changes or redistributes stored session times. */
export function notebookRows(
  entries: { title: string; minutes: number | null }[],
) {
  const rows: { minutes: number; titles: string[] }[] = [];
  const untimed: string[] = [];
  for (const entry of entries) {
    if (entry.minutes === null || entry.minutes <= 0) {
      untimed.push(
        entry.title + (entry.minutes === null ? " (시간 미입력)" : " (0분)"),
      );
      continue;
    }
    let remaining = entry.minutes;
    while (remaining > 1e-8) {
      let row = rows.at(-1);
      if (!row || row.minutes >= 90 - 1e-8) {
        row = { minutes: 0, titles: [] };
        rows.push(row);
      }
      const used = Math.min(90 - row.minutes, remaining);
      row.minutes += used;
      remaining -= used;
      if (!row.titles.includes(entry.title)) row.titles.push(entry.title);
    }
  }
  if (untimed.length) {
    if (!rows.length) rows.push({ minutes: 0, titles: [] });
    rows.at(-1)!.titles.push(...untimed);
  }
  return rows;
}
