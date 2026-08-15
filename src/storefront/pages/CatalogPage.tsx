import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PackageSearch } from 'lucide-react'
import { supabase, type Tables, type Views } from '@/lib/supabase'
import { useT, useLocalized } from '@/lib/i18n'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { ProductCard } from '@/storefront/components/ProductCard'
import { fetchPrimaryColorMap } from '@/storefront/lib'

type StorefrontProduct = Views<'v_storefront_products'>
type Category = Pick<Tables<'categories'>, 'id' | 'name_en' | 'name_ar' | 'slug'>

const PAGE_SIZE = 12
type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'best_selling'

export function CatalogPage() {
  const t = useT()
  useDocumentTitle(t('store.shop'))
  const getLocalized = useLocalized()
  const { slug: collectionSlug } = useParams<{ slug?: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  const q = searchParams.get('q') || ''
  const categoryId = searchParams.get('category') || ''
  const size = searchParams.get('size') || ''
  const color = searchParams.get('color') || ''
  const inStockOnly = searchParams.get('inStock') === '1'
  const minPrice = searchParams.get('min') || ''
  const maxPrice = searchParams.get('max') || ''
  const sort = (searchParams.get('sort') as SortOption) || 'newest'

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [colorMap, setColorMap] = useState<Record<string, string | null>>({})

  // The search box used to push a URL param (and fire a new query) on every
  // single keystroke. Typing "shirt" fired 5 queries in a row instead of
  // one. Local state + a short debounce means only the pause after typing
  // triggers the actual filter/query update.
  const [searchInput, setSearchInput] = useState(q)
  useEffect(() => {
    setSearchInput(q)
  }, [q])
  useEffect(() => {
    if (searchInput === q) return
    const handle = setTimeout(() => {
      setParam('q', searchInput)
    }, 350)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [q, categoryId, size, color, inStockOnly, minPrice, maxPrice, sort, collectionSlug])

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  const sanitizedSearch = useMemo(() => q.replace(/[,()."\\%_*]/g, '').trim(), [q])

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', 'public'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name_en, name_ar, slug')
        .eq('is_active', true)
        .order('position')
      if (error) return []
      return (data as Category[]) || []
    },
  })

  const { data: collection } = useQuery({
    queryKey: ['collections', collectionSlug],
    enabled: !!collectionSlug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .eq('slug', collectionSlug as string)
        .single()
      if (error) return null
      return data
    },
  })

  const { data: collectionProductIds } = useQuery({
    queryKey: ['collection_products', collection?.id],
    enabled: !!collection?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collection_products')
        .select('product_id')
        .eq('collection_id', collection!.id)
      if (error) return []
      return (data || []).map((r) => r.product_id)
    },
  })

  const { data: allProducts = [], isLoading } = useQuery({
    queryKey: [
      'storefront_products',
      'catalog',
      collectionSlug,
      collectionProductIds,
      sanitizedSearch,
      categoryId,
      size,
      color,
      inStockOnly,
      minPrice,
      maxPrice,
      sort,
    ],
    enabled: !collectionSlug || !!collectionProductIds,
    queryFn: async () => {
      let query = supabase.from('v_storefront_products').select('*')

      if (collectionSlug) {
        if (!collectionProductIds || collectionProductIds.length === 0) return []
        query = query.in('id', collectionProductIds)
      }
      if (sanitizedSearch) {
        query = query.or(
          `name_en.ilike.%${sanitizedSearch}%,name_ar.ilike.%${sanitizedSearch}%`
        )
      }
      if (categoryId) query = query.eq('category_id', categoryId)
      if (size) query = query.contains('sizes', [size])
      if (color) query = query.contains('colors', [color])
      if (inStockOnly) query = query.gt('available_stock', 0)
      if (minPrice) query = query.gte('price', parseFloat(minPrice))
      if (maxPrice) query = query.lte('price', parseFloat(maxPrice))

      switch (sort) {
        case 'price_asc':
          query = query.order('price', { ascending: true })
          break
        case 'price_desc':
          query = query.order('price', { ascending: false })
          break
        case 'best_selling':
          query = query.order('total_sold', { ascending: false })
          break
        default:
          query = query.order('published_at', { ascending: false })
      }

      const { data, error } = await query
      if (error) return []
      return (data as StorefrontProduct[]) || []
    },
  })

  const { data: facetOptions } = useQuery({
    queryKey: ['storefront_products', 'facets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_storefront_products')
        .select('sizes, colors')
      if (error) return { sizes: [], colors: [] }
      const sizes = new Set<string>()
      const colors = new Set<string>()
      for (const row of data || []) {
        for (const s of row.sizes || []) sizes.add(s)
        for (const c of row.colors || []) colors.add(c)
      }
      return { sizes: Array.from(sizes).sort(), colors: Array.from(colors).sort() }
    },
  })

  useEffect(() => {
    const ids = allProducts.map((p) => p.id).filter((id): id is string => !!id)
    if (ids.length === 0) return
    const missing = ids.filter((id) => !(id in colorMap))
    if (missing.length === 0) return
    fetchPrimaryColorMap(missing).then((map) => setColorMap((prev) => ({ ...prev, ...map })))
  }, [allProducts, colorMap])

  const visibleProducts = allProducts.slice(0, visibleCount)
  const hasMore = visibleCount < allProducts.length

  const resetFilters = () => {
    setSearchParams({}, { replace: true })
  }

  const hasActiveFilters = !!(q || categoryId || size || color || inStockOnly || minPrice || maxPrice)

  const heading = collection
    ? getLocalized(collection, 'title')
    : t('store.shopCatalog')

  return (
    <div className="px-6 py-12 lg:px-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="display text-4xl">{heading}</h1>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t('store.searchPlaceholder')}
          aria-label={t('store.searchLabel')}
          className="rounded-full border border-ink/20 bg-bone px-4 py-2.5 text-sm text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink sm:col-span-2"
        />
        <select
          value={categoryId}
          onChange={(e) => setParam('category', e.target.value)}
          aria-label={t('products.category')}
          className="rounded-full border border-ink/20 bg-bone px-4 py-2.5 text-sm text-ink"
        >
          <option value="">{t('store.allCategories')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {getLocalized(c, 'name')}
            </option>
          ))}
        </select>
        <select
          value={size}
          onChange={(e) => setParam('size', e.target.value)}
          aria-label={t('store.filterSize')}
          className="rounded-full border border-ink/20 bg-bone px-4 py-2.5 text-sm text-ink"
        >
          <option value="">{t('store.allSizes')}</option>
          {(facetOptions?.sizes || []).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={color}
          onChange={(e) => setParam('color', e.target.value)}
          aria-label={t('store.filterColor')}
          className="rounded-full border border-ink/20 bg-bone px-4 py-2.5 text-sm text-ink"
        >
          <option value="">{t('store.allColors')}</option>
          {(facetOptions?.colors || []).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setParam('sort', e.target.value)}
          aria-label={t('store.sortBy')}
          className="rounded-full border border-ink/20 bg-bone px-4 py-2.5 text-sm text-ink"
        >
          <option value="newest">{t('store.sortNewest')}</option>
          <option value="price_asc">{t('store.sortPriceAsc')}</option>
          <option value="price_desc">{t('store.sortPriceDesc')}</option>
          <option value="best_selling">{t('store.sortBestSelling')}</option>
        </select>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={minPrice}
            onChange={(e) => setParam('min', e.target.value)}
            placeholder={t('store.minPrice')}
            dir="ltr"
            className="w-28 rounded-full border border-ink/20 bg-bone px-3.5 py-2 text-sm text-ink"
          />
          <span className="text-moss">–</span>
          <input
            type="number"
            value={maxPrice}
            onChange={(e) => setParam('max', e.target.value)}
            placeholder={t('store.maxPrice')}
            dir="ltr"
            className="w-28 rounded-full border border-ink/20 bg-bone px-3.5 py-2 text-sm text-ink"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setParam('inStock', e.target.checked ? '1' : '')}
            className="rounded"
          />
          {t('store.inStockOnly')}
        </label>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="text-sm font-medium underline underline-offset-4"
          >
            {t('store.clearFilters')}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="animate-pulse">
              <div className="mb-3.5 aspect-[4/5] rounded-2xl bg-sand" />
              <div className="h-4 w-3/4 rounded bg-sand" />
            </div>
          ))}
        </div>
      ) : visibleProducts.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <PackageSearch className="h-10 w-10 text-moss" />
          <p className="text-moss">{t('store.noProductsMatch')}</p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-sm font-medium underline underline-offset-4"
            >
              {t('store.clearFilters')}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {visibleProducts.map((p) => (
              <ProductCard key={p.id} product={p} colorHex={p.id ? colorMap[p.id] : undefined} />
            ))}
          </div>
          {hasMore && (
            <div className="mt-10 flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="rounded-full border border-ink/25 px-7 py-3 text-sm font-medium transition-colors hover:bg-sand/40"
              >
                {t('store.loadMore')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
