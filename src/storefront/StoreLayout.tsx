import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Search, Heart, ShoppingBag, Menu, X, Globe } from 'lucide-react'
import { supabase, type Tables } from '@/lib/supabase'
import { useT, useLocale, useLocalized } from '@/lib/i18n'
import { useErrorText } from '@/lib/errors'
import { useCart } from '@/storefront/useCart'
import { useWishlist } from '@/storefront/useWishlist'
import { CartDrawer } from '@/storefront/components/CartDrawer'

type Marquee = Pick<Tables<'marquee_messages'>, 'id' | 'text_en' | 'text_ar'>
type NavCategory = Pick<Tables<'categories'>, 'id' | 'name_en' | 'name_ar' | 'slug'>

export function StoreLayout() {
  const t = useT()
  const { locale, setLocale } = useLocale()
  const navigate = useNavigate()
  const { count: cartCount } = useCart()
  const { productIds: wishlistIds } = useWishlist()

  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [cartOpen, setCartOpen] = useState(false)

  const { data: marquee = [] } = useQuery({
    queryKey: ['marquee_messages', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marquee_messages')
        .select('id, text_en, text_ar')
        .eq('is_active', true)
        .order('position')
      if (error) return []
      return (data as Marquee[]) || []
    },
  })

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchValue.trim()
    setSearchOpen(false)
    navigate(q ? `/shop?q=${encodeURIComponent(q)}` : '/shop')
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `relative pb-1 text-sm font-medium transition-colors ${
      isActive ? 'text-ink' : 'text-ink/70 hover:text-ink'
    }`

  return (
    <div className="min-h-screen bg-bone text-ink">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-bone"
      >
        {t('store.skipToContent')}
      </a>

      <nav className="sticky top-0 z-50 flex items-center justify-between gap-5 border-b border-sand bg-bone px-6 py-4 lg:px-12">
        <Link to="/" className="display text-2xl tracking-wide">
          VITALY
        </Link>

        <button
          type="button"
          className="flex flex-col gap-1.5 p-1.5 lg:hidden"
          aria-label={t('store.toggleMenu')}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <div
          className={`${
            mobileOpen ? 'flex' : 'hidden'
          } absolute start-0 top-full w-full flex-col gap-1 border-b border-sand bg-bone px-6 py-4 lg:static lg:flex lg:w-auto lg:flex-row lg:gap-9 lg:border-0 lg:p-0`}
        >
          <NavLink to="/shop" className={navLinkClass} onClick={() => setMobileOpen(false)}>
            {t('store.navShop')}
          </NavLink>
          <Link
            to="/account/login"
            className="pb-1 text-sm font-medium text-ink/70 transition-colors hover:text-ink lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            {t('auth.signIn')}
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-label={t('store.searchLabel')}
            onClick={() => setSearchOpen(true)}
            className="p-1"
          >
            <Search className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
            className="flex items-center gap-1 p-1 text-xs font-medium uppercase"
            aria-label={t('common.language')}
          >
            <Globe className="h-4 w-4" />
            {locale === 'ar' ? 'EN' : 'AR'}
          </button>
          <Link
            to="/account/login"
            className="hidden text-sm font-medium text-ink/70 transition-colors hover:text-ink lg:inline-block"
          >
            {t('auth.signIn')}
          </Link>
          <Link to="/account/wishlist" aria-label={t('store.wishlistLabel')} className="relative p-1">
            <Heart className="h-5 w-5" />
            {wishlistIds.length > 0 && (
              <span className="absolute -top-1.5 end-[-6px] flex h-4 min-w-4 items-center justify-center rounded-full bg-ember px-1 text-[10px] font-bold text-bone">
                {wishlistIds.length}
              </span>
            )}
          </Link>
          <button
            type="button"
            aria-label={t('store.cartLabel')}
            onClick={() => setCartOpen(true)}
            className="relative p-1"
          >
            <ShoppingBag className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 end-[-6px] flex h-4 min-w-4 items-center justify-center rounded-full bg-ember px-1 text-[10px] font-bold text-bone">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </nav>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />

      {searchOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center bg-ink/50 pt-24 sm:pt-32"
          onClick={() => setSearchOpen(false)}
        >
          <form
            onSubmit={handleSearchSubmit}
            onClick={(e) => e.stopPropagation()}
            className="flex w-[min(560px,90vw)] items-center gap-3 rounded-2xl bg-bone p-5 shadow-2xl"
          >
            <Search className="h-5 w-5 shrink-0 text-moss" />
            {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
            <input
              autoFocus
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder={t('store.searchPlaceholder')}
              aria-label={t('store.searchLabel')}
              className="flex-1 border-none bg-transparent text-lg text-ink outline-none placeholder:text-moss"
            />
            <button
              type="button"
              aria-label={t('common.close')}
              onClick={() => setSearchOpen(false)}
              className="text-2xl leading-none text-moss"
            >
              ×
            </button>
          </form>
        </div>
      )}

      {marquee.length > 0 && (
        <div className="overflow-hidden whitespace-nowrap border-b border-bone/15 bg-ink py-2.5 text-bone">
          <div className="inline-flex gap-9 [animation:store-marquee_18s_linear_infinite] motion-reduce:animate-none">
            {[...marquee, ...marquee].map((m, i) => (
              <span
                key={`${m.id}-${i}`}
                className="inline-flex items-center gap-2.5 text-[13px] font-medium uppercase tracking-wide"
              >
                {locale === 'ar' ? m.text_ar : m.text_en}
              </span>
            ))}
          </div>
        </div>
      )}

      <main id="main-content">
        <Outlet />
      </main>

      <StoreFooter />
    </div>
  )
}

function StoreFooter() {
  const t = useT()
  const getLocalized = useLocalized()
  const errorText = useErrorText()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Shares the same query cache as the header nav, so this doesn't add an
  // extra request.
  const { data: navCategories = [] } = useQuery({
    queryKey: ['categories', 'nav'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name_en, name_ar, slug')
        .eq('is_active', true)
        .order('position')
        .limit(4)
      if (error) return []
      return (data as NavCategory[]) || []
    },
  })

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
    if (!valid) {
      toast.error(t('store.invalidEmail'))
      return
    }
    setSubmitting(true)
    const { error } = await supabase
      .from('newsletter_subscribers')
      .insert({ email: trimmed, source: 'storefront_footer' })
    setSubmitting(false)
    if (error) {
      if (error.code === '23505') {
        toast.success(t('store.alreadySubscribed'))
      } else {
        toast.error(errorText(error))
      }
      return
    }
    toast.success(t('store.subscribed'))
    setEmail('')
  }

  return (
    <>
      <div className="mx-6 mt-16 flex flex-wrap items-center justify-between gap-8 rounded-[28px] border border-ink/15 p-8 lg:mx-12 lg:p-12">
        <div>
          <h3 className="display text-2xl">{t('store.newsletterTitle')}</h3>
          <p className="mt-1.5 text-sm text-moss">{t('store.newsletterBody')}</p>
        </div>
        <form onSubmit={handleSubscribe} className="flex flex-wrap gap-2.5">
          <label htmlFor="newsletter-email" className="sr-only">
            {t('store.emailAddress')}
          </label>
          <input
            id="newsletter-email"
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="min-w-60 rounded-full border border-ink/25 bg-bone px-5 py-3.5 text-sm text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-ink px-6 py-3.5 text-xs font-semibold uppercase tracking-wide text-bone transition-colors hover:bg-moss disabled:opacity-50"
          >
            {t('store.subscribe')}
          </button>
        </form>
      </div>

      <footer className="mt-5 grid grid-cols-2 gap-8 border-t border-ink/10 px-6 py-14 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-12">
        <div>
          <p className="display mb-3.5 text-xl">VITALY</p>
          <p className="max-w-[220px] text-[13px] leading-relaxed text-ink/60">
            {t('store.footerTagline')}
          </p>
        </div>
        <div>
          <h4 className="mb-4 text-xs uppercase tracking-wide text-ink/50">{t('store.footerShop')}</h4>
          <Link to="/shop" className="mb-2.5 block text-sm hover:text-ember">
            {t('store.navShop')}
          </Link>
          {navCategories.map((cat) => (
            <Link
              key={cat.id}
              to={`/shop?category=${cat.id}`}
              className="mb-2.5 block text-sm hover:text-ember"
            >
              {getLocalized(cat, 'name')}
            </Link>
          ))}
        </div>
        <div>
          <h4 className="mb-4 text-xs uppercase tracking-wide text-ink/50">{t('store.footerSupport')}</h4>
          <Link to="/track" className="mb-2.5 block text-sm hover:text-ember">
            {t('store.trackOrder')}
          </Link>
          <Link to="/account" className="mb-2.5 block text-sm hover:text-ember">
            {t('store.returns')}
          </Link>
        </div>
        <div>
          <h4 className="mb-4 text-xs uppercase tracking-wide text-ink/50">{t('store.footerAccount')}</h4>
          <Link to="/account/login" className="mb-2.5 block text-sm hover:text-ember">
            {t('auth.signIn')}
          </Link>
          <Link to="/account/orders" className="mb-2.5 block text-sm hover:text-ember">
            {t('store.orderHistory')}
          </Link>
        </div>
      </footer>
      <div className="flex justify-between px-6 py-6 text-xs text-ink/50 lg:px-12">
        <span>{t('store.copyright')}</span>
        <span>{t('store.madeToMove')}</span>
      </div>
    </>
  )
}
