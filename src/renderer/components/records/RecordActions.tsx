import { Pencil } from 'lucide-react'
import { Button } from '@renderer/components/ui/Button'

export function RecordActions({
  onEdit,
  onArchive
}: {
  onEdit: () => void
  onArchive: () => void
}) {
  return (
    <div className="flex shrink-0 flex-col gap-2">
      <Button size="sm" variant="secondary" onClick={onEdit}>
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </Button>
      <Button size="sm" variant="ghost" onClick={onArchive}>
        Archive
      </Button>
    </div>
  )
}
