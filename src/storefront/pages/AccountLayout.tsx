import { Navigate, NavLink, Outlet } from 'react-router-dom'
import { useT } from '@/lib/i18n'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useAuth } from '@/lib/auth'

export function AccountLayout() {
  const t = useT()
  useDocumentTitle(t('store.account'))
  const { user, loading, signOut } = useAuth()

  if (loading) {
    return <div className="px-6 py-24 text-center text-moss">{t('common.loading')}</div>
  }

  if (!user) {
    return <Navigate to="/account/login" replace />
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-4 py-2 text-sm font-medium transition-colors ${
      isActive ? 'bg-ink text-bone' : 'text-ink/70 hover:bg-sand/50'
    }`

  return (
    <div className="px-6 py-12 lg:px-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="display text-4xl">{t('store.myAccount')}</h1>
        <button
          type="button"
          onClick={() => signOut()}
          className="text-sm font-medium text-moss underline underline-offset-4"
        >
          {t('common.signOut')}
        </button>
      </div>

      <nav className="mb-8 flex flex-wrap gap-2 border-b border-sand pb-4">
        <NavLink to="/account/orders" className={linkClass}>
          {t('store.accountOrders')}
        </NavLink>
        <NavLink to="/account/profile" className={linkClass}>
          {t('store.accountProfile')}
        </NavLink>
        <NavLink to="/account/addresses" className={linkClass}>
          {t('store.accountAddresses')}
        </NavLink>
        <NavLink to="/account/wishlist" className={linkClass}>
          {t('store.accountWishlist')}
        </NavLink>
      </nav>

      <Outlet />
    </div>
  )
}
