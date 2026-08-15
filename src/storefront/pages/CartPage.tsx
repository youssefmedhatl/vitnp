import { Link } from 'react-router-dom'
import { useT, useLocale } from '@/lib/i18n'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { formatMoney } from '@/lib/money'
import { useCart } from '@/storefront/useCart'
import { CartLines } from '@/storefront/components/CartLines'

export function CartPage() {
  const t = useT()
  useDocumentTitle(t('store.cart'))
  const { locale } = useLocale()
  const { items, subtotal } = useCart()

  return (
    <div className="px-6 py-12 lg:px-12">
      <h1 className="display mb-8 text-4xl">{t('store.yourBag')}</h1>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
        <CartLines />

        {items.length > 0 && (
          <div className="h-fit rounded-2xl border border-sand p-6">
            <div className="mb-5 flex items-center justify-between text-[15px] font-semibold">
              <span>{t('store.subtotal')}</span>
              <span dir="ltr">{formatMoney(subtotal, locale)}</span>
            </div>
            <Link
              to="/checkout"
              className="block w-full rounded-full bg-ink py-4 text-center text-sm font-semibold uppercase tracking-wide text-bone transition-colors hover:bg-moss"
            >
              {t('store.checkout')}
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
