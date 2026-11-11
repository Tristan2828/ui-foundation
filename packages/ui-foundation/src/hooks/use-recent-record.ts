import { useEffect } from 'react'
import { rememberRecentRecord, type RecentRecord } from '@/lib/search-palette'

/**
 * Remembers a record as opened, on this device, for AppShell's search
 * palette, which lists the last few before you type (#N6). Call it in a
 * record's view once the record has loaded; pass nothing while it
 * loads. Kept in localStorage (the latest 20), forgotten on logout.
 *
 *   useRecentRecord(task && { title: task.title, to: `/tasks/${task.id}`, detail: 'Task' })
 */
export function useRecentRecord(record: RecentRecord | null | undefined | false): void {
  const title = record ? record.title : undefined
  const to = record ? record.to : undefined
  const detail = record ? record.detail : undefined
  useEffect(() => {
    if (title === undefined || to === undefined || !title.trim()) return
    rememberRecentRecord({ title, to, detail })
  }, [title, to, detail])
}
