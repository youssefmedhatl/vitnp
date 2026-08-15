import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { isSupabaseConfigured } from '@/lib/env'
import { useT } from '@/lib/i18n'
import { Spinner } from '@/components/ui'
import { CartProvider } from '@/storefront/useCart'
import { WishlistProvider } from '@/storefront/useWishlist'
import { StoreLayout } from '@/storefront/StoreLayout'
import { HomePage } from '@/storefront/pages/HomePage'

/**
 * Customer panel — storefront only. Split out of the combined app so this
 * can be deployed and run completely independently of the admin panel.
 *
 * StoreLayout and HomePage stay eager — they are the landing route, and
 * making them lazy would only add a request to the critical path. Everything
 * else loads on demand.
 *
 * These modules use named exports, so each import is mapped to `default`.
 */
const lazyNamed = <T extends Record<string, unknown>, K extends keyof T>(
  loader: () => Promise<T>,
  name: K
) => lazy(() => loader().then((m) => ({ default: m[name] as React.ComponentType })))

const CatalogPage = lazyNamed(() => import('@/storefront/pages/CatalogPage'), 'CatalogPage')
const ProductPage = lazyNamed(() => import('@/storefront/pages/ProductPage'), 'ProductPage')
const CartPage = lazyNamed(() => import('@/storefront/pages/CartPage'), 'CartPage')
const CheckoutPage = lazyNamed(() => import('@/storefront/pages/CheckoutPage'), 'CheckoutPage')
const OrderConfirmationPage = lazyNamed(() => import('@/storefront/pages/OrderConfirmationPage'), 'OrderConfirmationPage')
const TrackOrderPage = lazyNamed(() => import('@/storefront/pages/TrackOrderPage'), 'TrackOrderPage')
const AccountLoginPage = lazyNamed(() => import('@/storefront/pages/AccountLoginPage'), 'AccountLoginPage')
const AccountLayout = lazyNamed(() => import('@/storefront/pages/AccountLayout'), 'AccountLayout')
const OrdersSection = lazyNamed(() => import('@/storefront/pages/account/OrdersSection'), 'OrdersSection')
const ProfileSection = lazyNamed(() => import('@/storefront/pages/account/ProfileSection'), 'ProfileSection')
const AddressesSection = lazyNamed(() => import('@/storefront/pages/account/AddressesSection'), 'AddressesSection')
const WishlistSection = lazyNamed(() => import('@/storefront/pages/account/WishlistSection'), 'WishlistSection')

/** Shown while a route chunk is in flight. */
function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner />
    </div>
  )
}

/**
 * Not Configured page: shown when Supabase credentials are missing.
 */
function NotConfiguredPage() {
  const t = useT()

  return (
    <div className="flex items-center justify-center min-h-screen bg-bone px-4">
      <div className="max-w-md text-center">
        <h1 className="mb-4 text-3xl font-bold text-ink">Vitaly</h1>
        <p className="mb-6 text-lg text-moss">{t('error.notConfigured')}</p>
        <code className="block rounded-lg bg-sand p-4 text-sm text-ink">
          VITE_SUPABASE_URL
          <br />
          VITE_SUPABASE_ANON_KEY
        </code>
      </div>
    </div>
  )
}

/**
 * 404 page: not found
 */
function NotFoundPage() {
  const t = useT()

  return (
    <div className="flex items-center justify-center min-h-screen bg-bone">
      <div className="text-center">
        <h1 className="mb-4 text-6xl font-bold text-ink">404</h1>
        <p className="mb-8 text-lg text-moss">{t('error.notFound')}</p>
        <a
          href="/"
          className="rounded-full bg-ink px-6 py-2 font-medium text-bone hover:bg-ember transition-colors inline-block"
        >
          {t('common.back')}
        </a>
      </div>
    </div>
  )
}

/**
 * Main app component with routes and provider checks.
 */
export default function App() {
  if (!isSupabaseConfigured) {
    return <NotConfiguredPage />
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route
          path="/"
          element={
            <CartProvider>
              <WishlistProvider>
                <StoreLayout />
              </WishlistProvider>
            </CartProvider>
          }
        >
          <Route index element={<HomePage />} />
          <Route path="shop" element={<CatalogPage />} />
          <Route path="collections/:slug" element={<CatalogPage />} />
          <Route path="product/:slug" element={<ProductPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="order/:orderNumber" element={<OrderConfirmationPage />} />
          <Route path="track" element={<TrackOrderPage />} />
          <Route path="account/login" element={<AccountLoginPage />} />
          <Route path="account" element={<AccountLayout />}>
            <Route index element={<OrdersSection />} />
            <Route path="orders" element={<OrdersSection />} />
            <Route path="profile" element={<ProfileSection />} />
            <Route path="addresses" element={<AddressesSection />} />
            <Route path="wishlist" element={<WishlistSection />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
