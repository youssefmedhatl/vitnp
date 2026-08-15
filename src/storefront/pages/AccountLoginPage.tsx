import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { useT } from '@/lib/i18n'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { Button, Input } from '@/components/ui'

export function AccountLoginPage() {
  const navigate = useNavigate()
  const { signIn, signUp } = useAuth()
  const t = useT()
  useDocumentTitle(t('store.account'))

  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSending, setResetSending] = useState(false)

  // Clicking the link in a "reset your password" email lands back here with
  // a recovery session already active — Supabase fires this event once it
  // detects that token in the URL. Without this, the reset email would send
  // fine but there'd be no actual screen to set the new password on.
  const [recoveryMode, setRecoveryMode] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [updatingPassword, setUpdatingPassword] = useState(false)

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 6) {
      toast.error(t('auth.passwordTooShort'))
      return
    }
    setUpdatingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      toast.success(t('auth.passwordUpdated'))
      navigate('/account', { replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('auth.passwordUpdateFailed'))
    } finally {
      setUpdatingPassword(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (isSignUp) {
        await signUp(email, password, fullName)
        toast.success(t('auth.accountCreated'))
      } else {
        await signIn(email, password)
        toast.success(t('auth.signedIn'))
      }
      // Customers must never land in /admin — the storefront login always
      // returns to the storefront account, regardless of role.
      navigate('/account', { replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('auth.invalidCredentials'))
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    const trimmed = email.trim()
    if (!trimmed) {
      toast.error(t('auth.enterEmailFirst'))
      return
    }
    setResetSending(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: `${window.location.origin}/account/login`,
      })
      if (error) throw error
      // Always the same message whether or not the email exists — otherwise
      // this becomes a way to check which emails have accounts.
      toast.success(t('auth.resetEmailSent'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('auth.resetEmailFailed'))
    } finally {
      setResetSending(false)
    }
  }

  if (recoveryMode) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="display mb-2 text-3xl">VITALY</h1>
            <h2 className="mb-1 text-lg font-semibold text-ink">{t('auth.setNewPassword')}</h2>
          </div>
          <form
            onSubmit={handleSetNewPassword}
            className="space-y-4 rounded-2xl border border-sand bg-white p-6"
          >
            <div className="space-y-1">
              <label htmlFor="new-password" className="block text-sm font-medium text-ink">
                {t('auth.newPassword')}
                <span className="text-danger ms-1">*</span>
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  dir="ltr"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-xl border border-sand bg-bone px-4 py-2.5 pe-11 text-ink outline-none transition-colors focus:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-moss hover:text-ink"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" loading={updatingPassword} fullWidth>
              {t('auth.updatePassword')}
            </Button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="display mb-2 text-3xl">VITALY</h1>
          <h2 className="mb-1 text-lg font-semibold text-ink">
            {isSignUp ? t('store.createAccount') : t('store.signInTitle')}
          </h2>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-sand bg-white p-6"
        >
          {isSignUp && (
            <Input
              label={t('auth.fullName')}
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required={isSignUp}
            />
          )}
          <Input
            label={t('auth.email')}
            type="email"
            dir="ltr"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <div className="space-y-1">
            <label htmlFor="account-password" className="block text-sm font-medium text-ink">
              {t('auth.password')}
              <span className="text-danger ms-1">*</span>
            </label>
            <div className="relative">
              <input
                id="account-password"
                type={showPassword ? 'text' : 'password'}
                dir="ltr"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-sand bg-bone px-4 py-2.5 pe-11 text-ink outline-none transition-colors focus:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-moss hover:text-ink"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {!isSignUp && (
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={resetSending}
              className="block text-sm font-medium text-ink underline underline-offset-4 disabled:opacity-50"
            >
              {resetSending ? t('auth.sendingResetEmail') : t('auth.forgotPassword')}
            </button>
          )}

          <Button type="submit" loading={loading} fullWidth>
            {loading ? t('auth.signingIn') : isSignUp ? t('auth.signUp') : t('auth.signIn')}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm">
          {isSignUp ? (
            <>
              <span className="text-moss">{t('auth.haveAccount')} </span>
              <button
                type="button"
                onClick={() => setIsSignUp(false)}
                className="font-medium text-ink hover:underline"
              >
                {t('auth.signIn')}
              </button>
            </>
          ) : (
            <>
              <span className="text-moss">{t('auth.noAccount')} </span>
              <button
                type="button"
                onClick={() => setIsSignUp(true)}
                className="font-medium text-ink hover:underline"
              >
                {t('auth.signUp')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
