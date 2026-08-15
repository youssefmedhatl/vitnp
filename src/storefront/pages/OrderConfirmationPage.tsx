import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Printer } from 'lucide-react'
import { supabase, type Tables } from '@/lib/supabase'
import { useT, useLocale, useLocalized, useOrderItemName } from '@/lib/i18n'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useAuth } from '@/lib/auth'
import { formatMoney } from '@/lib/money'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'

type Order = Tables<'orders'>
type OrderItem = Tables<'order_items'>
type LocationRow = Pick<Tables<'locations'>, 'name_en' | 'name_ar'>

export function OrderConfirmationPage() {
  const t = useT()
  const { locale } = useLocale()
  const getLocalized = useLocalized()
  const orderItemName = useOrderItemName()
  const { orderNumber } = useParams<{ orderNumber: string }>()
  const routerLocation = useLocation()
  const { user } = useAuth()

  const stateOrder = (routerLocation.state as { order?: Order } | null)?.order

  const [order, setOrder] = useState<Order | null>(stateOrder ?? null)

  // Only attempt a live re-fetch when we don't already have the order from
  // navigation state (e.g. a reload) and the visitor is signed in — RLS only
  // exposes an order to staff or to the customer it belongs to, so a guest
  // reload genuinely cannot recover this page's data.
  const { data: fetchedOrder, isLoading } = useQuery({
    queryKey: ['order_confirmation', orderNumber],
    enabled: !stateOrder && !!user && !!orderNumber,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('order_number', orderNumber as string)
        .maybeSingle()
      if (error) return null
      return data as Order | null
    },
  })

  useEffect(() => {
    if (fetchedOrder) setOrder(fetchedOrder)
  }, [fetchedOrder])

  useDocumentTitle(orderNumber || t('store.account'))

  const { data: items = [] } = useQuery({
    queryKey: ['order_confirmation_items', order?.id],
    enabled: !!order?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order!.id)
      if (error) return []
      return (data as OrderItem[]) || []
    },
  })

  const { data: pickupLocation } = useQuery({
    queryKey: ['order_confirmation_location', order?.location_id],
    enabled: !!order?.location_id && order?.fulfillment === 'pickup',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('name_en, name_ar')
        .eq('id', order!.location_id as string)
        .maybeSingle()
      if (error) return null
      return data as LocationRow | null
    },
  })

  if (!order) {
    return (
      <div className="px-6 py-24 text-center">
        {isLoading ? (
          <p className="text-moss">{t('common.loading')}</p>
        ) : (
          <>
            <p className="text-moss">{t('store.confirmationUnavailable')}</p>
            <p className="mt-2 text-sm text-moss">{t('store.confirmationUnavailableHint')}</p>
            <div className="mt-5 flex justify-center gap-4">
              <Link to="/account/login" className="text-sm font-medium underline underline-offset-4">
                {t('auth.signIn')}
              </Link>
              <Link to="/shop" className="text-sm font-medium underline underline-offset-4">
                {t('store.browseCatalog')}
              </Link>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="print-area mx-auto max-w-2xl px-6 py-16">
      <div className="mb-8 text-center">
        <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-success" />
        <h1 className="display text-3xl">{t('store.orderConfirmed')}</h1>
        <p className="mt-2 text-sm text-moss" dir="ltr">
          {order.order_number}
        </p>
      </div>

      <div className="rounded-2xl border border-sand p-6">
        <p className="mb-4 text-sm font-medium text-ink">
          {order.fulfillment === 'delivery'
            ? t('store.cashOnDeliveryNote', { amount: formatMoney(order.total, locale) })
            : t('store.pickupPaymentNote', {
                branch: pickupLocation ? getLocalized(pickupLocation, 'name') : '',
              })}
        </p>

        <div className="divide-y divide-sand border-y border-sand">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div>
                <p className="font-medium text-ink">{orderItemName(item)}</p>
                {item.variant_label && <p className="text-xs text-moss">{item.variant_label}</p>}
              </div>
              <div className="flex items-center gap-4 text-moss">
                <span>×{item.quantity}</span>
                <span dir="ltr">{formatMoney(item.total, locale)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-moss">{t('orderDetail.subtotal')}</span>
            <span dir="ltr">{formatMoney(order.subtotal, locale)}</span>
          </div>
          {Number(order.discount_total) > 0 && (
            <div className="flex justify-between text-success">
              <span>{t('orderDetail.discount')}</span>
              <span dir="ltr">-{formatMoney(order.discount_total, locale)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-moss">{t('orderDetail.shipping')}</span>
            <span dir="ltr">{formatMoney(order.shipping_total, locale)}</span>
          </div>
          <div className="flex justify-between border-t border-sand pt-1.5 text-base font-semibold">
            <span>{t('common.total')}</span>
            <span dir="ltr">{formatMoney(order.total, locale)}</span>
          </div>
        </div>

        <div className="mt-5 space-y-1 text-sm text-moss">
          <p>
            {t('store.fulfilmentMethod')}:{' '}
            <span className="font-medium text-ink">
              {order.fulfillment === 'delivery' ? t('store.delivery') : t('store.pickup')}
            </span>
          </p>
          {order.fulfillment === 'pickup' && pickupLocation && (
            <p>
              {t('reports.branch')}:{' '}
              <span className="font-medium text-ink">{getLocalized(pickupLocation, 'name')}</span>
            </p>
          )}
          <p>
            {t('cash.date')}:{' '}
            <span className="font-medium text-ink">
              {format(new Date(order.placed_at), 'd MMM yyyy, p', {
                locale: locale === 'ar' ? ar : undefined,
              })}
            </span>
          </p>
        </div>
      </div>

      <div className="no-print mt-6 flex flex-wrap justify-center gap-4">
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-full border border-ink/20 px-6 py-3 text-sm font-medium"
        >
          <Printer className="h-4 w-4" /> {t('cash.print')}
        </button>
        <Link
          to="/shop"
          className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-bone hover:bg-moss"
        >
          {t('store.continueShopping')}
        </Link>
      </div>
    </div>
  )
}
