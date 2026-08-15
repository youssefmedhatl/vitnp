import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { supabase, type Tables } from '@/lib/supabase'
import { useT, useLocale } from '@/lib/i18n'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useAuth } from '@/lib/auth'
import { formatMoney } from '@/lib/money'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import { orderStatusLabel } from '@/storefront/lib'

type Order = Tables<'orders'>
type OrderEvent = Tables<'order_events'>

const STATUS_ORDER: Order['status'][] = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'out_for_delivery',
  'completed',
]

export function TrackOrderPage() {
  const t = useT()
  useDocumentTitle(t('store.trackOrder'))
  const { locale } = useLocale()
  const { user, loading } = useAuth()
  const [orderNumberInput, setOrderNumberInput] = useState('')
  const [searchedOrderNumber, setSearchedOrderNumber] = useState<string | null>(null)

  const search = useMutation({
    mutationFn: async (orderNumber: string) => {
      // RLS scopes this to orders belonging to the signed-in customer
      // (orders_read: is_staff() OR customer_id = my_customer_id()) — a
      // mismatched order number simply returns no rows, never someone
      // else's order.
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('order_number', orderNumber.trim())
        .maybeSingle()
      if (error) throw new Error(error.message)
      return data as Order | null
    },
    onSuccess: () => setSearchedOrderNumber(orderNumberInput.trim()),
  })

  const { data: events = [] } = useQuery({
    queryKey: ['order_events', search.data?.id],
    enabled: !!search.data?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_events')
        .select('*')
        .eq('order_id', search.data!.id)
        .order('created_at', { ascending: true })
      if (error) return []
      return (data as OrderEvent[]) || []
    },
  })

  if (loading) {
    return <div className="px-6 py-24 text-center text-moss">{t('common.loading')}</div>
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="display mb-4 text-3xl">{t('store.trackOrderTitle')}</h1>
        <p className="text-sm text-moss">{t('store.trackRequiresSignIn')}</p>
        <Link
          to="/account/login"
          className="mt-5 inline-block rounded-full bg-ink px-6 py-3 text-sm font-medium text-bone hover:bg-moss"
        >
          {t('auth.signIn')}
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <h1 className="display mb-2 text-3xl">{t('store.trackOrderTitle')}</h1>
      <p className="mb-6 text-sm text-moss">{t('store.trackOrderHint')}</p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (orderNumberInput.trim()) search.mutate(orderNumberInput.trim())
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          dir="ltr"
          value={orderNumberInput}
          onChange={(e) => setOrderNumberInput(e.target.value)}
          placeholder={t('store.orderNumberPlaceholder')}
          className="flex-1 rounded-full border border-ink/20 bg-bone px-5 py-3 text-sm outline-none"
        />
        <button
          type="submit"
          disabled={search.isPending}
          className="flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-medium text-bone disabled:opacity-50"
        >
          <Search className="h-4 w-4" /> {t('common.search')}
        </button>
      </form>

      {searchedOrderNumber && !search.isPending && (
        <div className="mt-8">
          {!search.data ? (
            <p className="text-sm text-moss">{t('store.orderNotFoundForYou')}</p>
          ) : (
            <div className="rounded-2xl border border-sand p-6">
              <div className="mb-4 flex items-center justify-between">
                <span dir="ltr" className="font-medium text-ink">
                  {search.data.order_number}
                </span>
                <span dir="ltr" className="text-sm text-moss">
                  {formatMoney(search.data.total, locale)}
                </span>
              </div>

              <ol className="space-y-3">
                {STATUS_ORDER.map((status) => {
                  const reached =
                    STATUS_ORDER.indexOf(search.data!.status) >= STATUS_ORDER.indexOf(status) &&
                    search.data!.status !== 'cancelled'
                  return (
                    <li key={status} className="flex items-center gap-3 text-sm">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${reached ? 'bg-ink' : 'bg-sand'}`}
                      />
                      <span className={reached ? 'font-medium text-ink' : 'text-moss'}>
                        {orderStatusLabel(t, status)}
                      </span>
                    </li>
                  )
                })}
                {search.data.status === 'cancelled' && (
                  <li className="flex items-center gap-3 text-sm text-danger">
                    <span className="h-2.5 w-2.5 rounded-full bg-danger" />
                    {orderStatusLabel(t, 'cancelled')}
                  </li>
                )}
              </ol>

              {events.length > 0 && (
                <div className="mt-5 space-y-2 border-t border-sand pt-4">
                  {events.map((e) => (
                    <div key={e.id} className="flex justify-between text-xs text-moss">
                      <span>{e.message || e.type}</span>
                      <span dir="ltr">
                        {format(new Date(e.created_at), 'd MMM, HH:mm', {
                          locale: locale === 'ar' ? ar : undefined,
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
