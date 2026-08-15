import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Heart, ShoppingBag, X } from 'lucide-react'
import { supabase, type Tables } from '@/lib/supabase'
import { useT, useLocale, useLocalized } from '@/lib/i18n'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useErrorText } from '@/lib/errors'
import { useAuth } from '@/lib/auth'
import { formatMoney, num } from '@/lib/money'
import { useCart } from '@/storefront/useCart'

type WishlistItem = Tables<'wishlist_items'>
type Product = Tables<'products'>

export function WishlistSection() {
  const t = useT()
  useDocumentTitle(t('store.accountWishlist'))
  const errorText = useErrorText()
  const { locale } = useLocale()
  const getLocalized = useLocalized()
  const { user } = useAuth()
  const { addItem } = useCart()
  const queryClient = useQueryClient()

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['account_wishlist', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wishlist_items')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
      if (error) return []
      return (data as WishlistItem[]) || []
    },
  })

  const productIds = items.map((i) => i.product_id)

  const { data: products = [] } = useQuery({
    queryKey: ['account_wishlist_products', productIds.join(',')],
    enabled: productIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(
          'id, slug, name_en, name_ar, description_en, description_ar, category_id, brand_id, status, price, compare_at_price, is_featured, is_new, tags, material_en, material_ar, care_en, care_ar, seo_title, seo_description, rating_avg, rating_count, total_sold, published_at, created_at, updated_at'
        )
        .in('id', productIds)
      if (error) return []
      return (data as Product[]) || []
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('wishlist_items').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['account_wishlist'] }),
    onError: (e) => toast.error(errorText(e)),
  })

  const moveToBag = useMutation({
    mutationFn: async (product: Product) => {
      const { data: variants, error } = await supabase
        .from('product_variants')
        .select(
          'id, product_id, sku, barcode, size, color_name, color_hex, price, weight_grams, position, is_active, created_at, updated_at'
        )
        .eq('product_id', product.id)
        .eq('is_active', true)
        .order('position')
        .limit(1)
      if (error || !variants || variants.length === 0) {
        throw new Error(t('store.errorNoVariantAvailable'))
      }
      const variant = variants[0]

      const { data: levels } = await supabase
        .from('inventory_levels')
        .select('quantity, reserved')
        .eq('variant_id', variant.id)
      const available = (levels || []).reduce(
        (sum, l) => sum + Math.max(0, l.quantity - l.reserved),
        0
      )
      if (available <= 0) throw new Error(t('store.outOfStock'))

      addItem(
        {
          variant_id: variant.id,
          quantity: 1,
          product_id: product.id,
          product_slug: product.slug,
          name: getLocalized(product, 'name'),
          size: variant.size,
          color_name: variant.color_name,
          color_hex: variant.color_hex,
          image: null,
          price: num(variant.price ?? product.price),
        },
        available
      )
      return { product, variant }
    },
    onSuccess: ({ product, variant }) => {
      toast.success(
        t('store.movedToBagWithVariant', {
          name: getLocalized(product, 'name'),
          variant: [variant.size, variant.color_name].filter(Boolean).join(' / '),
        })
      )
    },
    onError: (e) => toast.error(errorText(e)),
  })

  if (isLoading) {
    return <p className="text-sm text-moss">{t('common.loading')}</p>
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Heart className="h-8 w-8 text-moss" />
        <p className="text-sm text-moss">{t('store.wishlistEmpty')}</p>
        <Link to="/shop" className="text-sm font-medium underline underline-offset-4">
          {t('store.browseCatalog')}
        </Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const product = products.find((p) => p.id === item.product_id)
        if (!product) return null
        return (
          <div key={item.id} className="rounded-2xl border border-sand p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <Link to={`/product/${product.slug}`} className="text-sm font-medium text-ink hover:underline">
                {getLocalized(product, 'name')}
              </Link>
              <button
                type="button"
                aria-label={t('common.delete')}
                onClick={() => remove.mutate(item.id)}
                className="text-moss hover:text-danger"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p dir="ltr" className="mb-3 text-sm font-semibold text-ink">
              {formatMoney(product.price, locale)}
            </p>
            <button
              type="button"
              onClick={() => moveToBag.mutate(product)}
              disabled={moveToBag.isPending}
              className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs font-semibold uppercase tracking-wide text-bone disabled:opacity-50"
            >
              <ShoppingBag className="h-3.5 w-3.5" /> {t('store.moveToBag')}
            </button>
          </div>
        )
      })}
    </div>
  )
}
