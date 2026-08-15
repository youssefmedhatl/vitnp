import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { supabase, type Tables, type Views } from '@/lib/supabase'
import { useT, useLocalized } from '@/lib/i18n'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { ProductCard } from '@/storefront/components/ProductCard'
import { fetchPrimaryColorMap } from '@/storefront/lib'

type ContentBlock = Tables<'content_blocks'>
type Collection = Tables<'collections'>
type StorefrontProduct = Views<'v_storefront_products'>

const HERO_FALLBACK = '/vitality-hero.mp4'

export function HomePage() {
  const t = useT()
  useDocumentTitle('')
  const getLocalized = useLocalized()

  const { data: blocks } = useQuery({
    queryKey: ['content_blocks', 'public'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_blocks')
        .select('*')
        .eq('is_active', true)
        .in('key', ['hero'])
      if (error) return []
      return (data as ContentBlock[]) || []
    },
  })

  const hero = blocks?.find((b) => b.key === 'hero')

  const { data: newArrivals = [] } = useQuery({
    queryKey: ['storefront_products', 'new'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_storefront_products')
        .select('*')
        .eq('is_new', true)
        .limit(8)
      if (error) return []
      return (data as StorefrontProduct[]) || []
    },
  })

  const { data: featured = [] } = useQuery({
    queryKey: ['storefront_products', 'featured'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_storefront_products')
        .select('*')
        .eq('is_featured', true)
        .limit(8)
      if (error) return []
      return (data as StorefrontProduct[]) || []
    },
  })

  const { data: collections = [] } = useQuery({
    queryKey: ['collections', 'public'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .eq('is_active', true)
        .order('position')
      if (error) return []
      return (data as Collection[]) || []
    },
  })

  const [colorMap, setColorMap] = useState<Record<string, string | null>>({})

  useEffect(() => {
    const ids = [...newArrivals, ...featured].map((p) => p.id).filter((id): id is string => !!id)
    if (ids.length === 0) return
    fetchPrimaryColorMap(ids).then((map) => setColorMap((prev) => ({ ...prev, ...map })))
  }, [newArrivals, featured])

  const heroTitle = hero ? getLocalized(hero, 'title') : ''
  const heroSubtitle = hero ? getLocalized(hero, 'subtitle') : ''
  const heroCta = hero ? getLocalized(hero, 'cta_label') : ''
  const heroHref = hero?.cta_href || '/shop'
  const heroMediaUrl = hero?.media_url || HERO_FALLBACK
  const heroIsVideo = hero ? hero.media_type !== 'image' : true

  return (
    <div>
      {/* Hero */}
      <section className="relative flex h-[92vh] min-h-[560px] items-end overflow-hidden bg-ink">
        {heroIsVideo ? (
          <video
            autoPlay
            muted
            loop
            playsInline
            poster="/vitality-hero-poster.jpg"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: 'sepia(0.22) saturate(0.85) contrast(1.05) brightness(0.92)' }}
          >
            <source src={heroMediaUrl} type="video/mp4" />
          </video>
        ) : (
          <img
            src={heroMediaUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: 'sepia(0.22) saturate(0.85) contrast(1.05) brightness(0.92)' }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/25 to-ink/55" />
        {/* Fine gold hairline frame — a small old-money detail */}
        <div className="pointer-events-none absolute inset-5 z-[1] border border-warning/25 lg:inset-8" />

        <div className="relative z-[2] flex w-full flex-wrap items-end justify-between gap-10 px-6 pb-16 lg:px-12">
          <div>
            <span className="mb-5 inline-flex items-center gap-2 rounded-sm border border-bone/30 bg-bone/10 px-4 py-2.5 text-[12px] font-medium uppercase tracking-[0.16em] text-bone backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" />
              {t('store.heroTag')}
            </span>
            <h1 className="display italic text-bone" style={{ fontSize: 'clamp(48px, 8vw, 118px)' }}>
              {heroTitle || t('store.heroFallbackTitle')}
            </h1>
            {heroSubtitle && (
              <p className="mt-4 max-w-[380px] font-sans text-base leading-relaxed text-bone/75">
                {heroSubtitle}
              </p>
            )}
            <Link
              to={heroHref}
              className="mt-7 inline-flex items-center gap-2.5 rounded-sm bg-bone px-7 py-4 text-sm font-medium uppercase tracking-[0.12em] text-ink transition-all hover:-translate-y-0.5 hover:bg-sand"
            >
              {heroCta || t('store.heroCtaFallback')}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </div>
        </div>
      </section>

      {/* New arrivals */}
      {newArrivals.length > 0 && (
        <section className="px-6 py-16 lg:px-12">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-1 text-[11px] uppercase tracking-[0.2em] text-moss">{t('store.curatedLabel')}</p>
              <h2 className="display text-4xl">{t('store.newArrivals')}</h2>
            </div>
            <Link to="/shop" className="text-sm font-medium uppercase tracking-wide underline underline-offset-4">
              {t('store.viewAll')}
            </Link>
          </div>
          <div className="hairline mb-8" />
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {newArrivals.map((p) => (
              <ProductCard key={p.id} product={p} colorHex={p.id ? colorMap[p.id] : undefined} />
            ))}
          </div>
        </section>
      )}

      {/* Collections */}
      {collections.length > 0 && (
        <section className="px-6 py-16 lg:px-12">
          <p className="mb-1 text-[11px] uppercase tracking-[0.2em] text-moss">{t('store.exploreLabel')}</p>
          <h2 className="display mb-6 text-4xl">{t('store.collections')}</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {collections.map((c) => (
              <Link
                key={c.id}
                to={`/collections/${c.slug}`}
                className="group relative flex aspect-[16/9] items-end overflow-hidden rounded-md border border-ink/10 bg-sand"
              >
                {c.image_url ? (
                  <img
                    src={c.image_url}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="linen-texture absolute inset-0 flex items-center justify-center">
                    <span className="display text-5xl italic text-ink/20">
                      {getLocalized(c, 'title').charAt(0)}
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
                <div className="relative z-[1] p-6 text-bone">
                  <h3 className="display text-2xl">{getLocalized(c, 'title')}</h3>
                  {getLocalized(c, 'subtitle') && (
                    <p className="mt-1 text-sm text-bone/80">{getLocalized(c, 'subtitle')}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured */}
      {featured.length > 0 && (
        <section className="px-6 py-16 lg:px-12">
          <p className="mb-1 text-[11px] uppercase tracking-[0.2em] text-moss">{t('store.featuredLabel')}</p>
          <h2 className="display mb-6 text-4xl">{t('store.featured')}</h2>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} colorHex={p.id ? colorMap[p.id] : undefined} />
            ))}
          </div>
        </section>
      )}

    </div>
  )
}
