import { useEffect, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { useFocusTrap } from './useFocusTrap'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  const t = useT()
  const modalRef = useFocusTrap(open)

  useEffect(() => {
    if (!open) return

    // Lock body scroll
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Close on Escape
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    modalRef.current?.focus()

    return () => {
      document.body.style.overflow = originalOverflow
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open, onClose])

  if (!open) return null

  const sizeStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  }

  const titleId = title ? 'modal-title' : undefined

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'relative rounded-2xl border border-sand bg-white p-6',
          sizeStyles[size]
        )}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h2 id={titleId} className="text-lg font-semibold text-ink">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1 hover:bg-sand/50 transition-colors"
              aria-label={t('common.close')}
            >
              <X className="h-5 w-5 text-moss" />
            </button>
          </div>
        )}

        <div className="mb-6">{children}</div>

        {footer && (
          <div className="border-t border-sand pt-4 mt-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
