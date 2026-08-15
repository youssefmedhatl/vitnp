import { supabase, type Enums } from '@/lib/supabase'
import { useT } from '@/lib/i18n'

/**
 * v_storefront_products exposes `colors: string[]` (names only) — there is
 * no color_hex on the view. The placeholder block needs a real hex, so this
 * does one batched query against product_variants for the given product ids
 * and returns each product's first active variant's color_hex.
 */
export async function fetchPrimaryColorMap(
  productIds: string[]
): Promise<Record<string, string | null>> {
  if (productIds.length === 0) return {}

  const { data, error } = await supabase
    .from('product_variants')
    .select('product_id, color_hex, position')
    .in('product_id', productIds)
    .eq('is_active', true)
    .order('position')

  if (error || !data) return {}

  const map: Record<string, string | null> = {}
  for (const row of data) {
    if (!(row.product_id in map)) {
      map[row.product_id] = row.color_hex
    }
  }
  return map
}

/**
 * Translates an order_status enum value. A plain `t(\`status.${status}\`)`
 * doesn't typecheck because the template literal widens to `string`, not
 * the specific key union — this switch keeps it typed without a cast.
 */
export function orderStatusLabel(
  t: ReturnType<typeof useT>,
  status: Enums<'order_status'>
): string {
  switch (status) {
    case 'pending':
      return t('status.pending')
    case 'confirmed':
      return t('status.confirmed')
    case 'preparing':
      return t('status.preparing')
    case 'ready':
      return t('status.ready')
    case 'out_for_delivery':
      return t('status.out_for_delivery')
    case 'completed':
      return t('status.completed')
    case 'cancelled':
      return t('status.cancelled')
  }
}
