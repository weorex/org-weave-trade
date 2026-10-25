import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'

/**
 * Centered modal for every create/edit form and record detail view in the app.
 * Replaces inline sections that rendered at the bottom of long pages, which
 * forced users to scroll to find the form they just opened.
 */
export function FormDialog({ open, onClose, title, description, children, wide = false }: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  wide?: boolean
}) {
  return <Dialog open={open} onOpenChange={next => { if (!next) onClose() }}>
    <DialogContent className={`max-h-[85vh] overflow-y-auto ${wide ? 'sm:max-w-3xl' : 'sm:max-w-2xl'}`}>
      <DialogTitle>{title}</DialogTitle>
      {description && <DialogDescription>{description}</DialogDescription>}
      <div className="mt-2">{children}</div>
    </DialogContent>
  </Dialog>
}
