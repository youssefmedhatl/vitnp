import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase, type Tables } from '@/lib/supabase'
import { useT, useLocale } from '@/lib/i18n'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useAuth } from '@/lib/auth'
import { formatMoney } from '@/lib/money'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import { Package } from 'lucide-react'
import { orderStatusLabel } from '@/storefront/lib'

type Order = Tables<'orders'>

export function OrdersSection() {
  const t = useT()
  useDocumentTitle(t('store.accountOrders'))
  const { locale } = useLocale()
  const { user } = useAuth()

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['account_orders', user?.id],
    enabled: !!user,
    queryFn: async () => {
      // RLS scopes this to the signed-in customer automatically.
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('placed_at', { ascending: false })
      if (error) return []
      return (data as Order[]) || []
    },
  })

  if (isLoading) {
    return <p className="text-sm text-moss">{t('common.loading')}</p>
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Package className="h-8 w-8 text-moss" />
        <p className="text-sm text-moss">{t('store.noOrdersYet')}</p>
        <Link to="/shop" className="text-sm font-medium underline underline-offset-4">
          {t('store.browseCatalog')}
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {orders.map((o) => (
        <Link
          key={o.id}
          to={`/order/${o.order_number}`}
          className="flex items-center justify-between gap-4 rounded-2xl border border-sand p-4 hover:bg-sand/20"
        >
          <div>
            <p dir="ltr" className="text-sm font-medium text-ink">
              {o.order_number}
            </p>
            <p className="text-xs text-moss">
              {format(new Date(o.placed_at), 'd MMM yyyy', {
                locale: locale === 'ar' ? ar : undefined,
              })}
            </p>
          </div>
          <div className="text-end">
            <p className="text-sm font-medium text-ink" dir="ltr">
              {formatMoney(o.total, locale)}
            </p>
            <p className="text-xs text-moss">{orderStatusLabel(t, o.status)}</p>
          </div>
        </Link>
      ))}
    </div>
  )
}
