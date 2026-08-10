import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileUp, FolderOpen, Trash2, ExternalLink } from 'lucide-react'
import { Button } from '@renderer/components/ui/Button'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import { useVaultStore } from '@renderer/state/vaultStore'

function formatBytes(size: number | null): string {
  if (!size || size <= 0) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function EntryAttachments({ entryId }: { entryId: string }) {
  const queryClient = useQueryClient()
  const setSaveStatus = useVaultStore((s) => s.setSaveStatus)

  const attachmentsQuery = useQuery({
    queryKey: ['attachments', entryId],
    queryFn: () => unwrap(getEverkeepApi().attachments.list(entryId))
  })

  const attachMutation = useMutation({
    mutationFn: () => unwrap(getEverkeepApi().attachments.pickAndAttach(entryId)),
    onMutate: () => setSaveStatus('saving'),
    onSuccess: async (attachment) => {
      if (!attachment) {
        setSaveStatus('idle')
        return
      }
      setSaveStatus('saved')
      await queryClient.invalidateQueries({ queryKey: ['attachments', entryId] })
      window.setTimeout(() => setSaveStatus('idle'), 1500)
    },
    onError: () => setSaveStatus('error')
  })

  return (
    <div className="mt-4 rounded-lg border border-warm-200 bg-white/70 px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-warm-400">
          Attached files
        </p>
        <Button
          size="sm"
          variant="secondary"
          disabled={attachMutation.isPending}
          onClick={() => attachMutation.mutate()}
        >
          <FileUp className="h-3.5 w-3.5" />
          Upload
        </Button>
      </div>

      {(attachmentsQuery.data ?? []).length === 0 ? (
        <p className="text-sm text-warm-500">
          No file attached yet. Upload a PDF or scan so it can be opened from Everkeep.
        </p>
      ) : (
        <ul className="space-y-2">
          {(attachmentsQuery.data ?? []).map((attachment) => (
            <li
              key={attachment.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warm-200 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-charcoal-900">
                  {attachment.filename}
                </p>
                <p className="text-xs text-warm-400">{formatBytes(attachment.sizeBytes)}</p>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  title="Open"
                  onClick={() => void unwrap(getEverkeepApi().attachments.open(attachment.id))}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  title="Show in folder"
                  onClick={() => void unwrap(getEverkeepApi().attachments.reveal(attachment.id))}
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  title="Remove"
                  onClick={() =>
                    void unwrap(getEverkeepApi().attachments.remove(attachment.id)).then(() =>
                      queryClient.invalidateQueries({ queryKey: ['attachments', entryId] })
                    )
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
