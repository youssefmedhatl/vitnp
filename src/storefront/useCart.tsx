import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { num } from '@/lib/money'
import { useT } from '@/lib/i18n'

export interface CartLine {
  variant_id: string
  quantity: number
  product_id: string
  product_slug: string
  name: string
  size: string | null
  color_name: string | null
  color_hex: string | null
  image: string | null
  price: number
}

const CART_STORAGE_KEY = 'vitality.shop.cart'

function readStoredCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

interface CartContextValue {
  items: CartLine[]
  setItems: (items: CartLine[] | ((prev: CartLine[]) => CartLine[])) => void
  count: number
  subtotal: number
  addItem: (line: CartLine, availableQuantity: number) => void
  updateQuantity: (variant_id: string, quantity: number, availableQuantity: number) => void
  removeItem: (variant_id: string) => void
  clear: () => void
}

const CartContext = createContext<CartContextValue | undefined>(undefined)

/**
 * Storefront shopping bag, shared across the whole storefront route tree.
 * Persisted to localStorage['vitality.shop.cart'].
 * `variant_id` is the only identifier that determines a purchasable line —
 * never key a line by product id.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const t = useT()
  const [items, setItems] = useState<CartLine[]>(() => readStoredCart())
  const revalidated = useRef(false)
  // Always-current view of the bag, so the async stock check below reconciles
  // against the live contents instead of a stale closure.
  const itemsRef = useRef(items)

  useEffect(() => {
    itemsRef.current = items
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
    } catch {
      // Ignore storage errors (private browsing, quota, etc.)
    }
  }, [items])

  // Stock moves while a cart sits in localStorage — re-validate once per
  // session against live availability (sellable stock only, from branches
  // that actually fulfil online orders), dropping dead lines and capping
  // quantities, with a single toast if anything changed.
  useEffect(() => {
    if (revalidated.current) return
    if (items.length === 0) {
      revalidated.current = true
      return
    }
    revalidated.current = true

    const variantIds = items.map((i) => i.variant_id)

    const run = async () => {
      const { data: onlineLocations } = await supabase
        .from('locations')
        .select('id')
        .eq('is_active', true)
        .eq('sells_online', true)

      const locationIds = (onlineLocations || []).map((l) => l.id)
      if (locationIds.length === 0) return

      const { data: levels, error } = await supabase
        .from('inventory_levels')
        .select('variant_id, quantity, reserved')
        .in('variant_id', variantIds)
        .in('location_id', locationIds)

      if (error || !levels) return

      const availableByVariant: Record<string, number> = {}
      for (const row of levels) {
        availableByVariant[row.variant_id] =
          (availableByVariant[row.variant_id] || 0) + Math.max(0, row.quantity - row.reserved)
      }

      // Reconcile against whatever is in the bag *now*, not the snapshot taken
      // when this effect mounted — otherwise anything the shopper added while
      // the availability query was in flight gets silently overwritten.
      let changed = false
      const reconciled = itemsRef.current
        .filter((line) => {
          // A variant we did not ask about is left alone rather than dropped.
          if (!(line.variant_id in availableByVariant)) return true
          const available = availableByVariant[line.variant_id]
          if (available <= 0) {
            changed = true
            return false
          }
          return true
        })
        .map((line) => {
          if (!(line.variant_id in availableByVariant)) return line
          const available = availableByVariant[line.variant_id]
          if (line.quantity > available) {
            changed = true
            return { ...line, quantity: available }
          }
          return line
        })

      if (changed) {
        setItems(reconciled)
        toast(t('store.cartUpdatedForStock'))
      }
    }

    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addItem = useCallback((line: CartLine, availableQuantity: number) => {
    setItems((prev) => {
      const existing = prev.find((x) => x.variant_id === line.variant_id)
      if (existing) {
        const newQuantity = Math.min(existing.quantity + line.quantity, availableQuantity)
        return prev.map((x) =>
          x.variant_id === line.variant_id ? { ...x, quantity: newQuantity } : x
        )
      }
      return [...prev, { ...line, quantity: Math.min(line.quantity, availableQuantity) }]
    })
  }, [])

  const updateQuantity = useCallback(
    (variant_id: string, quantity: number, availableQuantity: number) => {
      setItems((prev) => {
        if (quantity <= 0) return prev.filter((x) => x.variant_id !== variant_id)
        const capped = Math.min(quantity, availableQuantity)
        return prev.map((x) => (x.variant_id === variant_id ? { ...x, quantity: capped } : x))
      })
    },
    []
  )

  const removeItem = useCallback((variant_id: string) => {
    setItems((prev) => prev.filter((x) => x.variant_id !== variant_id))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const count = items.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = items.reduce((sum, item) => sum + num(item.price) * item.quantity, 0)

  return (
    <CartContext.Provider
      value={{ items, setItems, count, subtotal, addItem, updateQuantity, removeItem, clear }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within CartProvider')
  }
  return context
}
