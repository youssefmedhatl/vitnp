import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { useT, useLocale } from '@/lib/i18n'
import { formatMoney } from '@/lib/money'
import { useCart } from '@/storefront/useCart'
import { CartLines } from '@/storefront/components/CartLines'

interface CartDrawerProps {
  open: boolean
  onClose: () => void
}

export function CartDrawer({ open, onClose }: CartDrawerProps) {
  const t = useT()
  const { locale } = useLocale()
  const { items, subtotal } = useCart()

  useEffect(() => {
    if (!open) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.body.style.overflow = originalOverflow
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[95] flex justify-end bg-ink/45" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t('store.cartLabel')}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-[min(420px,92vw)] flex-col bg-bone shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-sand px-6 py-5">
          <h2 className="text-lg font-medium">{t('store.yourBag')}</h2>
          <button type="button" aria-label={t('common.close')} onClick={onClose} className="text-moss">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-3">
          <CartLines onNavigate={onClose} compact />
        </div>

        {items.length > 0 && (
          <div className="border-t border-sand px-6 py-5">
            <div className="mb-4 flex items-center justify-between text-[15px] font-semibold">
              <span>{t('store.subtotal')}</span>
              <span dir="ltr">{formatMoney(subtotal, locale)}</span>
            </div>
            <Link
              to="/checkout"
              onClick={onClose}
              className="block w-full rounded-full bg-ink py-4 text-center text-sm font-semibold uppercase tracking-wide text-bone transition-colors hover:bg-moss"
            >
              {t('store.checkout')}
            </Link>
          </div>
        )}
      </aside>
    </div>,
    document.body
  )
}
