import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

/**
 * The signed-in visitor's `customers` row, matched by `user_id`.
 * A brand-new signee has none yet — `customers` rows are only created by
 * `create_online_order` on first checkout (matched on phone), so this can
 * legitimately return `data: null` for a signed-in user who has never
 * ordered. Callers must handle that as an empty state, not an error.
 */
export function useCustomer() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['storefront_customer', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}
