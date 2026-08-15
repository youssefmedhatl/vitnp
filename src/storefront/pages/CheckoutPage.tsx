import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase, type Tables, type Enums } from '@/lib/supabase'
import { useT, useLocale, useLocalized } from '@/lib/i18n'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useErrorText } from '@/lib/errors'
import { useAuth } from '@/lib/auth'
import { formatMoney, num } from '@/lib/money'
import { useCart } from '@/storefront/useCart'

type Location = Pick<Tables<'locations'>, 'id' | 'name_en' | 'name_ar'>
type Address = Tables<'customer_addresses'>

interface ShippingSetting {
  flat_fee?: number
  free_over?: number
}

interface DiscountResult {
  valid: boolean
  amount: number
  reason?: string
}

export function CheckoutPage() {
  const t = useT()
  useDocumentTitle(t('store.checkout'))
  const errorText = useErrorText()
  const { locale } = useLocale()
  const getLocalized = useLocalized()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { items, subtotal, clear } = useCart()

  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [fulfillment, setFulfillment] = useState<Enums<'fulfillment_type'>>('delivery')
  const [pickupLocationId, setPickupLocationId] = useState('')
  const [selectedAddressId, setSelectedAddressId] = useState<string>('new')
  const [line1, setLine1] = useState('')
  const [line2, setLine2] = useState('')
  const [city, setCity] = useState('')
  const [governorate, setGovernorate] = useState('')
  const [landmark, setLandmark] = useState('')
  const [discountCode, setDiscountCode] = useState('')
  const [discountResult, setDiscountResult] = useState<DiscountResult | null>(null)
  const [notes, setNotes] = useState('')
  const [placing, setPlacing] = useState(false)

  const { data: customer } = useQuery({
    queryKey: ['checkout', 'customer', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle()
      return data
    },
  })

  useEffect(() => {
    if (customer) {
      setContactName((v) => v || customer.full_name || '')
      setContactPhone((v) => v || customer.phone || '')
      setContactEmail((v) => v || customer.email || '')
    }
  }, [customer])

  const { data: savedAddresses = [] } = useQuery({
    queryKey: ['checkout', 'addresses', customer?.id],
    enabled: !!customer?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_addresses')
        .select('*')
        .eq('customer_id', customer!.id)
        .order('is_default', { ascending: false })
      if (error) return []
      return (data as Address[]) || []
    },
  })

  useEffect(() => {
    if (savedAddresses.length > 0 && selectedAddressId === 'new') {
      const def = savedAddresses.find((a) => a.is_default) || savedAddresses[0]
      setSelectedAddressId(def.id)
    }
  }, [savedAddresses])

  useEffect(() => {
    if (selectedAddressId === 'new') return
    const addr = savedAddresses.find((a) => a.id === selectedAddressId)
    if (addr) {
      setLine1(addr.line1)
      setLine2(addr.line2 || '')
      setCity(addr.city)
      setGovernorate(addr.governorate || '')
      setLandmark(addr.landmark || '')
    }
  }, [selectedAddressId, savedAddresses])

  const { data: locations = [] } = useQuery({
    queryKey: ['locations', 'checkout'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name_en, name_ar')
        .eq('is_active', true)
        // create_online_order rejects a branch that does not serve online, so
        // only offer branches that can actually take the order.
        .eq('sells_online', true)
        .order('position')
      if (error) return []
      return (data as Location[]) || []
    },
  })

  const { data: shipping } = useQuery({
    queryKey: ['settings', 'shipping', 'checkout'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_setting', {
        p_key: 'shipping',
        // Must match create_online_order's fallback exactly, otherwise a
        // missing `shipping` setting shows free delivery here and then charges
        // 50 on the order.
        p_default: { flat_fee: 50, free_over: 1500 },
      })
      if (error) return null
      return data as ShippingSetting | null
    },
  })

  // validate_discount returns machine reasons ('expired', 'min_subtotal', …).
  // They were rendered raw, so an Arabic shopper saw English enum values.
  const discountReasonText = (reason?: string): string => {
    switch (reason) {
      case 'not_found':
        return t('store.discountReasonNotFound')
      case 'inactive':
        return t('store.discountReasonInactive')
      case 'not_started':
        return t('store.discountReasonNotStarted')
      case 'expired':
        return t('store.discountReasonExpired')
      case 'usage_limit_reached':
        return t('store.discountReasonUsageLimit')
      case 'customer_limit_reached':
        return t('store.discountReasonCustomerLimit')
      case 'min_subtotal':
        return t('store.discountReasonMinSubtotal')
      default:
        return t('store.discountRejected')
    }
  }

  const discountAmount = discountResult?.valid ? discountResult.amount : 0
  const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount)
  const flatFee = num(shipping?.flat_fee)
  const freeOver = shipping?.free_over
  const qualifiesFreeShipping =
    typeof freeOver === 'number' && freeOver > 0 && subtotalAfterDiscount >= freeOver
  const shippingPreview = fulfillment === 'delivery' ? (qualifiesFreeShipping ? 0 : flatFee) : 0
  const totalPreview = subtotalAfterDiscount + shippingPreview

  const checkDiscount = useMutation({
    mutationFn: async () => {
      const code = discountCode.trim().toUpperCase()
      if (!code) throw new Error(t('store.errorDiscountCodeRequired'))
      const { data, error } = await supabase.rpc('validate_discount', {
        p_code: code,
        p_subtotal: subtotal,
        p_customer_id: customer?.id,
      })
      if (error) throw new Error(error.message)
      const res = data as unknown as { valid?: boolean; amount?: number | string; reason?: string }
      return { valid: !!res?.valid, amount: num(res?.amount), reason: res?.reason }
    },
    onSuccess: (res) => setDiscountResult(res),
    onError: (e) => toast.error(errorText(e)),
  })

  const placeOrder = useMutation({
    mutationFn: async () => {
      if (!contactName.trim()) throw new Error(t('store.errorNameRequired'))
      if (!contactPhone.trim()) throw new Error(t('store.errorPhoneRequired'))
      if (fulfillment === 'delivery' && !line1.trim()) {
        throw new Error(t('store.errorAddressRequired'))
      }
      if (fulfillment === 'pickup' && !pickupLocationId) {
        throw new Error(t('store.errorPickupBranchRequired'))
      }
      if (items.length === 0) throw new Error(t('store.errorBagEmpty'))

      const address =
        fulfillment === 'delivery'
          ? {
              full_name: contactName.trim(),
              phone: contactPhone.trim(),
              line1: line1.trim(),
              line2: line2.trim() || null,
              city: city.trim(),
              governorate: governorate.trim() || null,
              landmark: landmark.trim() || null,
            }
          : null

      // Never send prices — create_online_order reads every price from the
      // database and ignores anything the browser claims.
      const { data, error } = await supabase.rpc('create_online_order', {
        p_items: items.map((i) => ({ variant_id: i.variant_id, quantity: i.quantity })),
        p_contact_name: contactName.trim(),
        p_contact_phone: contactPhone.trim(),
        p_contact_email: contactEmail.trim() || undefined,
        p_fulfillment: fulfillment,
        p_address: address ?? undefined,
        p_discount_code: discountResult?.valid ? discountCode.trim().toUpperCase() : undefined,
        p_notes: notes.trim() || undefined,
        p_location_id: fulfillment === 'pickup' ? pickupLocationId : undefined,
      })

      if (error) throw new Error(error.message)
      return data
    },
    onMutate: () => setPlacing(true),
    onSuccess: (order) => {
      clear()
      navigate(`/order/${order.order_number}`, { state: { order } })
    },
    onError: (e) => {
      toast.error(errorText(e))
      setPlacing(false)
    },
  })

  if (items.length === 0 && !placing) {
    return (
      <div className="px-6 py-24 text-center">
        <p className="text-moss">{t('store.emptyBag')}</p>
        <a href="/shop" className="mt-4 inline-block text-sm font-medium underline underline-offset-4">
          {t('store.browseCatalog')}
        </a>
      </div>
    )
  }

  return (
    <div className="px-6 py-12 lg:px-12">
      <h1 className="display mb-8 text-4xl">{t('store.checkout')}</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (placing || placeOrder.isPending) return
          placeOrder.mutate()
        }}
        className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]"
      >
        <div className="space-y-8">
          {/* Contact */}
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink">
              {t('store.contact')}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="checkout-name" className="sr-only">
                  {t('customers.name')}
                </label>
                <input
                  id="checkout-name"
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder={t('customers.name')}
                  className="w-full rounded-xl border border-ink/20 bg-bone px-4 py-3 text-sm outline-none"
                />
              </div>
              <div>
                <label htmlFor="checkout-phone" className="sr-only">
                  {t('customers.phone')}
                </label>
                <input
                  id="checkout-phone"
                  type="tel"
                  required
                  dir="ltr"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder={t('customers.phone')}
                  className="w-full rounded-xl border border-ink/20 bg-bone px-4 py-3 text-sm outline-none"
                />
              </div>
              <div>
                <label htmlFor="checkout-email" className="sr-only">
                  {t('customers.email')}
                </label>
                <input
                  id="checkout-email"
                  type="email"
                  dir="ltr"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder={`${t('customers.email')} (${t('store.optional')})`}
                  className="w-full rounded-xl border border-ink/20 bg-bone px-4 py-3 text-sm outline-none"
                />
              </div>
            </div>
          </section>

          {/* Fulfilment */}
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink">
              {t('store.fulfilment')}
            </h2>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setFulfillment('delivery')}
                className={`flex-1 rounded-xl border px-4 py-3 text-sm font-medium ${
                  fulfillment === 'delivery' ? 'border-ink bg-ink text-bone' : 'border-ink/20 text-ink'
                }`}
              >
                {t('store.delivery')}
              </button>
              <button
                type="button"
                onClick={() => setFulfillment('pickup')}
                className={`flex-1 rounded-xl border px-4 py-3 text-sm font-medium ${
                  fulfillment === 'pickup' ? 'border-ink bg-ink text-bone' : 'border-ink/20 text-ink'
                }`}
              >
                {t('store.pickup')}
              </button>
            </div>

            {fulfillment === 'pickup' && (
              <select
                value={pickupLocationId}
                onChange={(e) => setPickupLocationId(e.target.value)}
                className="mt-3 w-full rounded-xl border border-ink/20 bg-bone px-4 py-3 text-sm outline-none"
              >
                <option value="">{t('store.choosePickupBranch')}</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {getLocalized(loc, 'name')}
                  </option>
                ))}
              </select>
            )}
          </section>

          {/* Address */}
          {fulfillment === 'delivery' && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink">
                {t('store.deliveryAddress')}
              </h2>

              {savedAddresses.length > 0 && (
                <select
                  value={selectedAddressId}
                  onChange={(e) => setSelectedAddressId(e.target.value)}
                  className="mb-3 w-full rounded-xl border border-ink/20 bg-bone px-4 py-3 text-sm outline-none"
                >
                  {savedAddresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.line1}, {a.city}
                    </option>
                  ))}
                  <option value="new">{t('store.newAddress')}</option>
                </select>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="checkout-line1" className="sr-only">
                    {t('store.addressLine1')}
                  </label>
                  <input
                    id="checkout-line1"
                    type="text"
                    required
                    value={line1}
                    onChange={(e) => setLine1(e.target.value)}
                    placeholder={t('store.addressLine1')}
                    className="w-full rounded-xl border border-ink/20 bg-bone px-4 py-3 text-sm outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="checkout-line2" className="sr-only">
                    {t('store.addressLine2')}
                  </label>
                  <input
                    id="checkout-line2"
                    type="text"
                    value={line2}
                    onChange={(e) => setLine2(e.target.value)}
                    placeholder={t('store.addressLine2')}
                    className="w-full rounded-xl border border-ink/20 bg-bone px-4 py-3 text-sm outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="checkout-city" className="sr-only">
                    {t('customers.city')}
                  </label>
                  <input
                    id="checkout-city"
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder={t('customers.city')}
                    className="w-full rounded-xl border border-ink/20 bg-bone px-4 py-3 text-sm outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="checkout-governorate" className="sr-only">
                    {t('store.governorate')}
                  </label>
                  <input
                    id="checkout-governorate"
                    type="text"
                    value={governorate}
                    onChange={(e) => setGovernorate(e.target.value)}
                    placeholder={t('store.governorate')}
                    className="w-full rounded-xl border border-ink/20 bg-bone px-4 py-3 text-sm outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="checkout-landmark" className="sr-only">
                    {t('store.landmark')}
                  </label>
                  <input
                    id="checkout-landmark"
                    type="text"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    placeholder={t('store.landmark')}
                    className="w-full rounded-xl border border-ink/20 bg-bone px-4 py-3 text-sm outline-none"
                  />
                </div>
              </div>
            </section>
          )}

          {/* Notes */}
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink">
              {t('store.orderNotes')} ({t('store.optional')})
            </h2>
            <label htmlFor="checkout-notes" className="sr-only">
              {t('store.orderNotes')}
            </label>
            <textarea
              id="checkout-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-ink/20 bg-bone px-4 py-3 text-sm outline-none"
            />
          </section>
        </div>

        {/* Summary */}
        <div className="h-fit space-y-4 rounded-2xl border border-sand p-6">
          <div>
            <label htmlFor="checkout-discount" className="mb-2 block text-sm font-medium text-ink">
              {t('store.discountCode')}
            </label>
            <div className="flex gap-2">
              <input
                id="checkout-discount"
                type="text"
                dir="ltr"
                value={discountCode}
                onChange={(e) => {
                  setDiscountCode(e.target.value.toUpperCase())
                  setDiscountResult(null)
                }}
                placeholder={t('store.discountCodePlaceholder')}
                className="flex-1 rounded-full border border-ink/20 bg-bone px-4 py-2 text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => checkDiscount.mutate()}
                disabled={checkDiscount.isPending || !discountCode.trim()}
                className="rounded-full border border-ink/20 px-4 py-2 text-xs font-medium uppercase disabled:opacity-50"
              >
                {t('store.apply')}
              </button>
            </div>
            {discountResult && (
              <p className={`mt-1.5 text-xs ${discountResult.valid ? 'text-success' : 'text-danger'}`}>
                {discountResult.valid
                  ? t('store.discountApplied')
                  : discountReasonText(discountResult.reason)}
              </p>
            )}
          </div>

          <div className="space-y-2 border-t border-sand pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-moss">{t('orderDetail.subtotal')}</span>
              <span dir="ltr">{formatMoney(subtotal, locale)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-success">
                <span>{t('orderDetail.discount')}</span>
                <span dir="ltr">-{formatMoney(discountAmount, locale)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-moss">{t('orderDetail.shipping')}</span>
              <span dir="ltr">
                {fulfillment === 'pickup'
                  ? t('store.freePickup')
                  : shippingPreview === 0
                    ? t('store.freeShippingUnlocked')
                    : formatMoney(shippingPreview, locale)}
              </span>
            </div>
            <div className="flex justify-between border-t border-sand pt-2 text-base font-semibold">
              <span>{t('common.total')}</span>
              <span dir="ltr">{formatMoney(totalPreview, locale)}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={placing || placeOrder.isPending}
            className="w-full rounded-full bg-ink py-4 text-sm font-semibold uppercase tracking-wide text-bone transition-colors hover:bg-moss disabled:cursor-not-allowed disabled:opacity-50"
          >
            {placing || placeOrder.isPending ? t('store.placingOrder') : t('store.placeOrder')}
          </button>
        </div>
      </form>
    </div>
  )
}
