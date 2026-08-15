import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Heart, Minus, Plus, Star } from 'lucide-react'
import { supabase, type Tables } from '@/lib/supabase'
import { useT, useLocale, useLocalized } from '@/lib/i18n'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useErrorText } from '@/lib/errors'
import { useAuth } from '@/lib/auth'
import { formatMoney, num } from '@/lib/money'
import { useCart } from '@/storefront/useCart'
import { useWishlist } from '@/storefront/useWishlist'
import { ProductCard } from '@/storefront/components/ProductCard'
import { fetchPrimaryColorMap } from '@/storefront/lib'
import type { Views } from '@/lib/supabase'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'

type Product = Tables<'products'>
type ProductImage = Tables<'product_images'>
type Variant = Tables<'product_variants'>
type Review = Tables<'reviews'>
type StorefrontProduct = Views<'v_storefront_products'>

const LOW_STOCK_THRESHOLD = 5

export function ProductPage() {
  const t = useT()
  const errorText = useErrorText()
  const { locale } = useLocale()
  const getLocalized = useLocalized()
  const { slug } = useParams<{ slug: string }>()
  const { user, profile } = useAuth()
  const { addItem } = useCart()
  const { isWishlisted, toggle } = useWishlist()
  const queryClient = useQueryClient()

  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: ['product', slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(
          'id, slug, name_en, name_ar, description_en, description_ar, category_id, brand_id, status, price, compare_at_price, is_featured, is_new, tags, material_en, material_ar, care_en, care_ar, seo_title, seo_description, rating_avg, rating_count, total_sold, published_at, created_at, updated_at'
        )
        .eq('slug', slug as string)
        .eq('status', 'active')
        .single()
      if (error) return null
      return data as Product
    },
  })

  useDocumentTitle(product ? getLocalized(product, 'name') : t('store.shop'))

  const { data: images = [] } = useQuery({
    queryKey: ['product_images', product?.id],
    enabled: !!product?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_images')
        .select('*')
        .eq('product_id', product!.id)
        .order('position')
      if (error) return []
      return (data as ProductImage[]) || []
    },
  })

  const { data: variants = [] } = useQuery({
    queryKey: ['product_variants', product?.id],
    enabled: !!product?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_variants')
        .select(
          'id, product_id, sku, barcode, size, color_name, color_hex, price, weight_grams, position, is_active, created_at, updated_at'
        )
        .eq('product_id', product!.id)
        .eq('is_active', true)
        .order('position')
      if (error) return []
      return (data as Variant[]) || []
    },
  })

  const { data: stockByVariant = {} } = useQuery({
    queryKey: ['product_stock', product?.id, variants.map((v) => v.id).join(',')],
    enabled: variants.length > 0,
    queryFn: async () => {
      const variantIds = variants.map((v) => v.id)

      const { data: onlineLocations } = await supabase
        .from('locations')
        .select('id')
        .eq('is_active', true)
        .eq('sells_online', true)

      const locationIds = (onlineLocations || []).map((l) => l.id)
      if (locationIds.length === 0) return {}

      const { data: levels, error } = await supabase
        .from('inventory_levels')
        .select('variant_id, quantity, reserved')
        .in('variant_id', variantIds)
        .in('location_id', locationIds)

      if (error || !levels) return {}

      const map: Record<string, number> = {}
      for (const row of levels) {
        const available = Math.max(0, row.quantity - row.reserved)
        map[row.variant_id] = (map[row.variant_id] || 0) + available
      }
      return map
    },
  })

  const { data: reviews = [] } = useQuery({
    queryKey: ['reviews', product?.id],
    enabled: !!product?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('product_id', product!.id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
      if (error) return []
      return (data as Review[]) || []
    },
  })

  const { data: relatedRaw = [] } = useQuery({
    queryKey: ['related_products', product?.category_id, product?.id],
    enabled: !!product?.category_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_storefront_products')
        .select('*')
        .eq('category_id', product!.category_id as string)
        .neq('id', product!.id)
        .limit(4)
      if (error) return []
      return (data as StorefrontProduct[]) || []
    },
  })

  const [relatedColorMap, setRelatedColorMap] = useState<Record<string, string | null>>({})
  useEffect(() => {
    const ids = relatedRaw.map((p) => p.id).filter((id): id is string => !!id)
    if (ids.length === 0) return
    fetchPrimaryColorMap(ids).then(setRelatedColorMap)
  }, [relatedRaw])

  const sizes = useMemo(
    () => Array.from(new Set(variants.map((v) => v.size).filter((s): s is string => !!s))),
    [variants]
  )
  const colors = useMemo(() => {
    const seen = new Map<string, string | null>()
    for (const v of variants) {
      if (v.color_name && !seen.has(v.color_name)) seen.set(v.color_name, v.color_hex)
    }
    return Array.from(seen.entries())
  }, [variants])

  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [galleryColorFilter, setGalleryColorFilter] = useState<string | null>(null)

  useEffect(() => {
    if (sizes.length > 0 && !selectedSize) setSelectedSize(sizes[0])
    if (colors.length > 0 && !selectedColor) setSelectedColor(colors[0][0])
  }, [sizes, colors, selectedSize, selectedColor])

  const availableForCombo = (size: string | null, colorName: string | null) => {
    const variant = variants.find(
      (v) => (size === null || v.size === size) && (colorName === null || v.color_name === colorName)
    )
    if (!variant) return 0
    return stockByVariant[variant.id] || 0
  }

  const selectedVariant = useMemo(
    () =>
      variants.find(
        (v) =>
          (sizes.length === 0 || v.size === selectedSize) &&
          (colors.length === 0 || v.color_name === selectedColor)
      ) || null,
    [variants, selectedSize, selectedColor, sizes.length, colors.length]
  )

  const availableStock = selectedVariant ? stockByVariant[selectedVariant.id] || 0 : 0

  useEffect(() => {
    setQuantity((q) => Math.min(Math.max(1, q), Math.max(1, availableStock)))
  }, [availableStock])

  const filteredImages = useMemo(() => {
    if (galleryColorFilter) {
      const matching = images.filter((img) => img.color_name === galleryColorFilter)
      if (matching.length > 0) return matching
    }
    return images
  }, [images, galleryColorFilter])

  const handleColorSelect = (colorName: string) => {
    setSelectedColor(colorName)
    setGalleryColorFilter(colorName)
  }

  const handleAddToBag = () => {
    if (!product || !selectedVariant) return
    if (availableStock <= 0) return

    addItem(
      {
        variant_id: selectedVariant.id,
        quantity,
        product_id: product.id,
        product_slug: product.slug,
        name: getLocalized(product, 'name'),
        size: selectedVariant.size,
        color_name: selectedVariant.color_name,
        color_hex: selectedVariant.color_hex,
        image: images[0]?.url || null,
        price: num(selectedVariant.price ?? product.price),
      },
      availableStock
    )
    toast.success(t('store.addedToBag', { name: getLocalized(product, 'name') }))
  }

  const submitReview = useMutation({
    mutationFn: async ({
      rating,
      title,
      body,
      authorName,
    }: {
      rating: number
      title: string
      body: string
      authorName: string
    }) => {
      if (!user || !product) throw new Error(t('store.errorSignInToReview'))
      const { error } = await supabase.from('reviews').insert({
        product_id: product.id,
        user_id: user.id,
        author_name: authorName.trim() || t('store.anonymousReviewer'),
        rating,
        title: title.trim() || null,
        body: body.trim() || null,
        status: 'pending',
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      toast.success(t('store.reviewSubmitted'))
      queryClient.invalidateQueries({ queryKey: ['reviews', product?.id] })
    },
    onError: (e) => toast.error(errorText(e)),
  })

  if (productLoading) {
    return (
      <div className="px-6 py-16 lg:px-12">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <div className="aspect-[4/5] animate-pulse rounded-2xl bg-sand" />
          <div className="space-y-4">
            <div className="h-8 w-2/3 animate-pulse rounded bg-sand" />
            <div className="h-5 w-1/3 animate-pulse rounded bg-sand" />
          </div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="px-6 py-24 text-center">
        <p className="text-moss">{t('store.productNotFound')}</p>
        <Link to="/shop" className="mt-4 inline-block text-sm font-medium underline underline-offset-4">
          {t('store.backToShop')}
        </Link>
      </div>
    )
  }

  const name = getLocalized(product, 'name')
  const description = getLocalized(product, 'description')
  const material = getLocalized(product, 'material')
  const care = getLocalized(product, 'care')
  const hasCompareAt = product.compare_at_price !== null && num(product.compare_at_price) > num(product.price)
  const wishlisted = isWishlisted(product.id)

  return (
    <div className="px-6 py-12 lg:px-12">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        {/* Gallery */}
        <div>
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-sand">
            {filteredImages.length > 0 ? (
              <img
                src={filteredImages[0].url}
                alt={filteredImages[0].alt || name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className="h-full w-full"
                style={{
                  backgroundColor:
                    variants.find((v) => v.color_name === selectedColor)?.color_hex || '#E4D8C3',
                }}
              />
            )}
          </div>
          {filteredImages.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-3">
              {filteredImages.slice(1, 5).map((img) => (
                <div key={img.id} className="aspect-[4/5] overflow-hidden rounded-xl bg-sand">
                  <img src={img.url} alt={img.alt || ''} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          {product.is_new && (
            <span className="mb-3 inline-block rounded-full bg-ember px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-bone">
              {t('store.newBadge')}
            </span>
          )}
          <h1 className="display text-4xl">{name}</h1>

          {product.rating_count > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex items-center gap-0.5" dir="ltr">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    className={
                      i < Math.round(num(product.rating_avg))
                        ? 'h-4 w-4 fill-warning text-warning'
                        : 'h-4 w-4 text-sand'
                    }
                  />
                ))}
              </div>
              <span className="text-sm text-moss">
                {t('store.reviewCount', { count: product.rating_count })}
              </span>
            </div>
          )}

          <div className="mt-4 flex items-center gap-3" dir="ltr">
            <span className="text-2xl font-bold text-ink">
              {formatMoney(selectedVariant?.price ?? product.price, locale)}
            </span>
            {hasCompareAt && (
              <span className="text-lg text-moss line-through">
                {formatMoney(product.compare_at_price, locale)}
              </span>
            )}
          </div>

          {description && <p className="mt-5 text-[15px] leading-relaxed text-moss">{description}</p>}

          {/* Colors */}
          {colors.length > 0 && (
            <div className="mt-7">
              <p className="mb-2 text-sm font-medium text-ink">{t('store.color')}</p>
              <div className="flex flex-wrap gap-2.5">
                {colors.map(([colorName, hex]) => {
                  const isSelected = selectedColor === colorName
                  const comboAvailable = availableForCombo(selectedSize, colorName)
                  return (
                    <button
                      key={colorName}
                      type="button"
                      onClick={() => handleColorSelect(colorName)}
                      disabled={comboAvailable <= 0}
                      aria-pressed={isSelected}
                      aria-label={colorName}
                      title={colorName}
                      className={`h-9 w-9 rounded-full border-2 transition-transform disabled:cursor-not-allowed disabled:opacity-30 ${
                        isSelected ? 'border-ink scale-110' : 'border-sand'
                      }`}
                      style={{ backgroundColor: hex || '#E4D8C3' }}
                    />
                  )
                })}
              </div>
            </div>
          )}

          {/* Sizes */}
          {sizes.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-sm font-medium text-ink">{t('store.size')}</p>
              <div className="flex flex-wrap gap-2">
                {sizes.map((s) => {
                  const comboAvailable = availableForCombo(s, selectedColor)
                  const isSelected = selectedSize === s
                  const disabled = comboAvailable <= 0
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSelectedSize(s)}
                      disabled={disabled}
                      aria-pressed={isSelected}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                        isSelected ? 'border-ink bg-ink text-bone' : 'border-ink/25 text-ink'
                      } ${disabled ? 'cursor-not-allowed opacity-40 line-through' : 'hover:border-ink'}`}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Stock hint */}
          <p className="mt-3 text-xs text-moss">
            {availableStock <= 0
              ? t('store.outOfStock')
              : availableStock <= LOW_STOCK_THRESHOLD
                ? t('store.onlyNLeft', { count: availableStock })
                : t('store.inStock')}
          </p>

          {/* Quantity + Add to bag */}
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 rounded-full border border-ink/20 px-3 py-2">
              <button
                type="button"
                aria-label={t('pos.quantityDecrease')}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="disabled:opacity-30"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-6 text-center text-sm">{quantity}</span>
              <button
                type="button"
                aria-label={t('pos.quantityIncrease')}
                onClick={() => setQuantity((q) => Math.min(availableStock, q + 1))}
                disabled={quantity >= availableStock}
                className="disabled:opacity-30"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleAddToBag}
              disabled={availableStock <= 0 || !selectedVariant}
              className="flex-1 rounded-full bg-ink px-7 py-3.5 text-sm font-semibold uppercase tracking-wide text-bone transition-colors hover:bg-moss disabled:cursor-not-allowed disabled:opacity-40"
            >
              {availableStock <= 0 ? t('store.outOfStock') : t('store.addToBag')}
            </button>

            <button
              type="button"
              aria-label={wishlisted ? t('store.removeFromWishlist', { name }) : t('store.addToWishlist', { name })}
              aria-pressed={wishlisted}
              onClick={() => toggle(product.id)}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-ink/20"
            >
              <Heart
                className="h-5 w-5"
                style={wishlisted ? { fill: '#A0492E', stroke: '#A0492E' } : { stroke: '#2B2320' }}
              />
            </button>
          </div>

          {(material || care) && (
            <div className="mt-8 space-y-2 border-t border-sand pt-6 text-sm text-moss">
              {material && (
                <p>
                  <span className="font-medium text-ink">{t('store.material')}: </span>
                  {material}
                </p>
              )}
              {care && (
                <p>
                  <span className="font-medium text-ink">{t('store.care')}: </span>
                  {care}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reviews */}
      <section className="mt-16 border-t border-sand pt-10">
        <h2 className="display mb-6 text-3xl">
          {t('store.reviewsHeading', { count: product.rating_count })}
        </h2>

        {reviews.length === 0 ? (
          <p className="text-sm text-moss">{t('store.noReviewsYet')}</p>
        ) : (
          <div className="mb-8 space-y-5">
            {reviews.map((r) => (
              <div key={r.id} className="border-b border-sand pb-5">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5" dir="ltr">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        className={
                          i < r.rating ? 'h-3.5 w-3.5 fill-warning text-warning' : 'h-3.5 w-3.5 text-sand'
                        }
                      />
                    ))}
                  </div>
                  <span className="text-sm font-medium text-ink">{r.author_name}</span>
                  <span className="text-xs text-moss">
                    {format(new Date(r.created_at), 'd MMM yyyy', {
                      locale: locale === 'ar' ? ar : undefined,
                    })}
                  </span>
                </div>
                {r.title && <p className="mt-1.5 text-sm font-medium text-ink">{r.title}</p>}
                {r.body && <p className="mt-1 text-sm text-moss">{r.body}</p>}
                {r.reply && (
                  <p className="mt-2 rounded-lg bg-bone px-3 py-2 text-xs text-moss">
                    <span className="font-medium text-ink">{t('store.storeReply')}: </span>
                    {r.reply}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {user ? (
          <ReviewForm
            defaultAuthor={profile?.full_name || ''}
            onSubmit={(vals) => submitReview.mutate(vals)}
            pending={submitReview.isPending}
          />
        ) : (
          <p className="text-sm text-moss">
            <Link to="/account/login" className="font-medium underline underline-offset-4">
              {t('auth.signIn')}
            </Link>{' '}
            {t('store.signInToReview')}
          </p>
        )}
      </section>

      {/* Related products */}
      {relatedRaw.length > 0 && (
        <section className="mt-16 border-t border-sand pt-10">
          <h2 className="display mb-6 text-3xl">{t('store.relatedProducts')}</h2>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            {relatedRaw.map((p) => (
              <ProductCard key={p.id} product={p} colorHex={p.id ? relatedColorMap[p.id] : undefined} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function ReviewForm({
  defaultAuthor,
  onSubmit,
  pending,
}: {
  defaultAuthor: string
  onSubmit: (vals: { rating: number; title: string; body: string; authorName: string }) => void
  pending: boolean
}) {
  const t = useT()
  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [authorName, setAuthorName] = useState(defaultAuthor)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ rating, title, body, authorName })
        setTitle('')
        setBody('')
      }}
      className="max-w-lg space-y-3 rounded-2xl border border-sand p-5"
    >
      <p className="text-sm font-medium text-ink">{t('store.writeReview')}</p>
      <div className="flex items-center gap-1" dir="ltr">
        {Array.from({ length: 5 }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setRating(i + 1)}
            aria-label={t('store.ratingStars', { count: i + 1 })}
          >
            <Star
              className={i < rating ? 'h-6 w-6 fill-warning text-warning' : 'h-6 w-6 text-sand'}
            />
          </button>
        ))}
      </div>
      <input
        type="text"
        value={authorName}
        onChange={(e) => setAuthorName(e.target.value)}
        placeholder={t('store.yourName')}
        required
        className="w-full rounded-xl border border-sand bg-bone px-3.5 py-2.5 text-sm outline-none"
      />
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('store.reviewTitlePlaceholder')}
        className="w-full rounded-xl border border-sand bg-bone px-3.5 py-2.5 text-sm outline-none"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t('store.reviewBodyPlaceholder')}
        rows={3}
        className="w-full rounded-xl border border-sand bg-bone px-3.5 py-2.5 text-sm outline-none"
      />
      <p className="text-xs text-moss">{t('store.reviewPendingHint')}</p>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-ink px-6 py-2.5 text-xs font-semibold uppercase tracking-wide text-bone disabled:opacity-50"
      >
        {t('store.submitReview')}
      </button>
    </form>
  )
}
