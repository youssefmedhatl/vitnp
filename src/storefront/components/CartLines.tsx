import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Minus, Plus, ShoppingBag, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useT, useLocale } from '@/lib/i18n'
import { formatMoney, num } from '@/lib/money'
import { useCart } from '@/storefront/useCart'

interface ShippingSetting {
  flat_fee?: number
  free_over?: number
}

interface CartLinesProps {
  onNavigate?: () => void
  compact?: boolean
}

export function CartLines({ onNavigate, compact = false }: CartLinesProps) {
  const t = useT()
  const { locale } = useLocale()
  const { items, subtotal, updateQuantity, removeItem } = useCart()

  const { data: variantStock = {} } = useQuery({
    queryKey: ['cart_stock', items.map((i) => i.variant_id).join(',')],
    enabled: items.length > 0,
    queryFn: async () => {
      const variantIds = items.map((i) => i.variant_id)

      const { data: onlineLocations } = await supabase
        .from('locations')
        .select('id')
        .eq('is_active', true)
        .eq('sells_online', true)

      const locationIds = (onlineLocations || []).map((l) => l.id)
      if (locationIds.length === 0) return {}

      const { data: levels } = await supabase
        .from('inventory_levels')
        .select('variant_id, quantity, reserved')
        .in('variant_id', variantIds)
        .in('location_id', locationIds)

      const map: Record<string, number> = {}
      for (const row of levels || []) {
        map[row.variant_id] = (map[row.variant_id] || 0) + Math.max(0, row.quantity - row.reserved)
      }
      return map
    },
  })

  const { data: shipping } = useQuery({
    queryKey: ['settings', 'shipping', 'public'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_setting', {
        p_key: 'shipping',
        p_default: { flat_fee: 0, free_over: null },
      })
      if (error) return null
      return data as ShippingSetting | null
    },
  })

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <ShoppingBag className="h-8 w-8 text-moss" />
        <p className="text-sm text-moss">{t('store.emptyBag')}</p>
        <Link
          to="/shop"
          onClick={onNavigate}
          className="text-sm font-medium underline underline-offset-4"
        >
          {t('store.browseCatalog')}
        </Link>
      </div>
    )
  }

  const freeOver = shipping?.free_over
  const remainingForFree =
    typeof freeOver === 'number' && freeOver > 0 ? Math.max(0, freeOver - subtotal) : 0

  return (
    <div>
      <div className={compact ? 'divide-y divide-sand' : 'divide-y divide-sand rounded-2xl border border-sand'}>
        {items.map((line) => {
          const available = variantStock[line.variant_id] ?? line.quantity
          return (
            <div key={line.variant_id} className="flex gap-3.5 p-4">
              <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-sand">
                {line.image ? (
                  <img src={line.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div
                    className="h-full w-full"
                    style={{ backgroundColor: line.color_hex || '#E4D8C3' }}
                  />
                )}
              </div>
              <div className="flex flex-1 flex-col justify-center gap-1.5">
                <Link
                  to={`/product/${line.product_slug}`}
                  onClick={onNavigate}
                  className="text-sm font-medium text-ink hover:underline"
                >
                  {line.name}
                </Link>
                <p className="text-xs text-moss">
                  {[line.size, line.color_name].filter(Boolean).join(' / ')}
                </p>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 rounded-full border border-ink/20 px-2.5 py-1">
                    <button
                      type="button"
                      aria-label={t('pos.quantityDecrease')}
                      onClick={() => updateQuantity(line.variant_id, line.quantity - 1, available)}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="min-w-3.5 text-center text-xs">{line.quantity}</span>
                    <button
                      type="button"
                      aria-label={t('pos.quantityIncrease')}
                      onClick={() => updateQuantity(line.variant_id, line.quantity + 1, available)}
                      disabled={line.quantity >= available}
                      className="disabled:opacity-30"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    aria-label={t('store.removeFromBag', { name: line.name })}
                    onClick={() => removeItem(line.variant_id)}
                    className="text-moss hover:text-danger"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="shrink-0 text-sm font-medium text-ink" dir="ltr">
                {formatMoney(num(line.price) * line.quantity, locale)}
              </div>
            </div>
          )
        })}
      </div>

      {remainingForFree > 0 && (
        <p className="mt-4 text-xs text-moss">
          {t('store.freeShippingProgress', { amount: formatMoney(remainingForFree, locale) })}
        </p>
      )}
      {typeof freeOver === 'number' && freeOver > 0 && subtotal >= freeOver && (
        <p className="mt-4 text-xs text-success">{t('store.freeShippingUnlocked')}</p>
      )}
    </div>
  )
}
