import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

const WISHLIST_STORAGE_KEY = 'vitality.shop.wishlist'

function readStoredWishlist(): string[] {
  try {
    const raw = localStorage.getItem(WISHLIST_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

interface WishlistContextValue {
  productIds: string[]
  isWishlisted: (productId: string) => boolean
  toggle: (productId: string) => void
}

const WishlistContext = createContext<WishlistContextValue | undefined>(undefined)

/**
 * Guest wishlist, local to the browser only — product ids in localStorage.
 * A signed-in customer's durable wishlist lives in `wishlist_items` and is
 * managed from the Account page; this is the anonymous-browsing heart toggle.
 */
export function WishlistProvider({ children }: { children: ReactNode }) {
  const [productIds, setProductIds] = useState<string[]>(() => readStoredWishlist())

  useEffect(() => {
    try {
      localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(productIds))
    } catch {
      // Ignore storage errors
    }
  }, [productIds])

  const isWishlisted = useCallback(
    (productId: string) => productIds.includes(productId),
    [productIds]
  )

  const toggle = useCallback((productId: string) => {
    setProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    )
  }, [])

  return (
    <WishlistContext.Provider value={{ productIds, isWishlisted, toggle }}>
      {children}
    </WishlistContext.Provider>
  )
}

export function useWishlist() {
  const context = useContext(WishlistContext)
  if (!context) {
    throw new Error('useWishlist must be used within WishlistProvider')
  }
  return context
}
