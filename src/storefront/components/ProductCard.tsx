import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'
import type { Views } from '@/lib/supabase'
import { useT, useLocale, useLocalized } from '@/lib/i18n'
import { formatMoney, num } from '@/lib/money'
import { useWishlist } from '@/storefront/useWishlist'

type StorefrontProduct = Views<'v_storefront_products'>

interface ProductCardProps {
  product: StorefrontProduct
  colorHex?: string | null
}

export function ProductCard({ product, colorHex }: ProductCardProps) {
  const t = useT()
  const { locale } = useLocale()
  const getLocalized = useLocalized()
  const { isWishlisted, toggle } = useWishlist()

  if (!product.id || !product.slug) return null

  const name = getLocalized(product, 'name')
  const categoryName = product.category_name_en ? getLocalized(product, 'category_name') : ''
  const outOfStock = (product.available_stock ?? 0) <= 0
  const wishlisted = isWishlisted(product.id)
  const hasCompareAt =
    product.compare_at_price !== null && num(product.compare_at_price) > num(product.price)

  return (
    <div className="group">
      <Link to={`/product/${product.slug}`} className="block">
        <div className="relative mb-3.5 aspect-[4/5] overflow-hidden rounded-md border border-ink/10 bg-sand">
          {product.primary_image ? (
            <img
              src={product.primary_image}
              alt={name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:-translate-y-1.5"
              loading="lazy"
            />
          ) : (
            <div className="linen-texture flex h-full w-full items-center justify-center transition-transform duration-300 group-hover:-translate-y-1.5">
              <span
                className="display text-3xl text-ink/25"
                style={colorHex ? { color: colorHex } : undefined}
              >
                {name.charAt(0)}
              </span>
            </div>
          )}

          {product.is_new && (
            <span className="absolute start-3 top-3 rounded-sm bg-ember px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-bone">
              {t('store.newBadge')}
            </span>
          )}

          <button
            type="button"
            aria-label={
              wishlisted
                ? t('store.removeFromWishlist', { name })
                : t('store.addToWishlist', { name })
            }
            aria-pressed={wishlisted}
            onClick={(e) => {
              e.preventDefault()
              toggle(product.id as string)
            }}
            className="absolute end-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-bone/90 transition-transform hover:scale-110"
          >
            <Heart
              className="h-4 w-4"
              style={
                wishlisted
                  ? { fill: '#A0492E', stroke: '#A0492E' }
                  : { stroke: '#2B2320' }
              }
            />
          </button>

          {outOfStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-ink/50">
              <span className="rounded-sm bg-bone px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-ink">
                {t('store.outOfStock')}
              </span>
            </div>
          )}
        </div>

        <p className="font-display text-lg font-semibold text-ink">{name}</p>
        {categoryName && (
          <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-moss">{categoryName}</p>
        )}
        <div className="mt-2 flex items-center gap-2" dir="ltr">
          <span className="text-[15px] font-semibold text-ink">{formatMoney(product.price, locale)}</span>
          {hasCompareAt && (
            <span className="text-xs text-moss line-through">
              {formatMoney(product.compare_at_price, locale)}
            </span>
          )}
        </div>
      </Link>
    </div>
  )
}
