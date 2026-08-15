import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase, type Tables } from '@/lib/supabase'
import { useT } from '@/lib/i18n'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useErrorText } from '@/lib/errors'
import { useCustomer } from '@/storefront/useCustomer'
import { Button, Input, Modal, Badge } from '@/components/ui'
import { MapPin, Plus, Edit2, Trash2 } from 'lucide-react'

type Address = Tables<'customer_addresses'>

export function AddressesSection() {
  const t = useT()
  useDocumentTitle(t('store.accountAddresses'))
  const errorText = useErrorText()
  const { data: customer } = useCustomer()
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Address | null>(null)

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ['account_addresses', customer?.id],
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

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('customer_addresses').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      toast.success(t('common.saved'))
      queryClient.invalidateQueries({ queryKey: ['account_addresses'] })
    },
    onError: (e) => toast.error(errorText(e)),
  })

  if (!customer) {
    return <p className="text-sm text-moss">{t('store.noProfileYet')}</p>
  }

  if (isLoading) {
    return <p className="text-sm text-moss">{t('common.loading')}</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          size="sm"
          icon={Plus}
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          {t('store.addAddress')}
        </Button>
      </div>

      {addresses.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <MapPin className="h-8 w-8 text-moss" />
          <p className="text-sm text-moss">{t('store.noAddressesYet')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {addresses.map((a) => (
            <div key={a.id} className="rounded-2xl border border-sand p-4">
              <div className="mb-2 flex items-center gap-2">
                <p className="text-sm font-medium text-ink">{a.full_name || customer.full_name}</p>
                {a.is_default && <Badge tone="info">{t('customers.defaultAddress')}</Badge>}
              </div>
              <p className="text-sm text-moss">
                {[a.line1, a.line2, a.city, a.governorate].filter(Boolean).join('، ')}
              </p>
              {a.phone && (
                <p dir="ltr" className="mt-1 text-sm text-moss">
                  {a.phone}
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setEditing(a)
                    setFormOpen(true)
                  }}
                >
                  <Edit2 className="h-3.5 w-3.5" /> {t('common.edit')}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => remove.mutate(a.id)}>
                  <Trash2 className="h-3.5 w-3.5" /> {t('common.delete')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <AddressFormModal
          address={editing}
          customerId={customer.id}
          onClose={() => setFormOpen(false)}
        />
      )}
    </div>
  )
}

function AddressFormModal({
  address,
  customerId,
  onClose,
}: {
  address: Address | null
  customerId: string
  onClose: () => void
}) {
  const t = useT()
  const errorText = useErrorText()
  const queryClient = useQueryClient()

  const [fullName, setFullName] = useState(address?.full_name ?? '')
  const [phone, setPhone] = useState(address?.phone ?? '')
  const [line1, setLine1] = useState(address?.line1 ?? '')
  const [line2, setLine2] = useState(address?.line2 ?? '')
  const [city, setCity] = useState(address?.city ?? '')
  const [governorate, setGovernorate] = useState(address?.governorate ?? '')
  const [landmark, setLandmark] = useState(address?.landmark ?? '')
  const [isDefault, setIsDefault] = useState(address?.is_default ?? false)

  const save = useMutation({
    mutationFn: async () => {
      if (!line1.trim() || !city.trim()) throw new Error(t('store.errorAddressRequired'))
      const payload = {
        customer_id: customerId,
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
        line1: line1.trim(),
        line2: line2.trim() || null,
        city: city.trim(),
        governorate: governorate.trim() || null,
        landmark: landmark.trim() || null,
        is_default: isDefault,
      }
      const { error } = address
        ? await supabase.from('customer_addresses').update(payload).eq('id', address.id)
        : await supabase.from('customer_addresses').insert(payload)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      toast.success(t('common.saved'))
      queryClient.invalidateQueries({ queryKey: ['account_addresses'] })
      onClose()
    },
    onError: (e) => toast.error(errorText(e)),
  })

  return (
    <Modal open onClose={onClose} size="md" title={address ? t('common.edit') : t('store.addAddress')}>
      <div className="space-y-4">
        <Input label={t('customers.name')} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <Input label={t('customers.phone')} dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input label={t('store.addressLine1')} required value={line1} onChange={(e) => setLine1(e.target.value)} />
        <Input label={t('store.addressLine2')} value={line2} onChange={(e) => setLine2(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('customers.city')} required value={city} onChange={(e) => setCity(e.target.value)} />
          <Input label={t('store.governorate')} value={governorate} onChange={(e) => setGovernorate(e.target.value)} />
        </div>
        <Input label={t('store.landmark')} value={landmark} onChange={(e) => setLandmark(e.target.value)} />
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="rounded" />
          <span className="text-sm text-ink">{t('store.setAsDefault')}</span>
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {t('common.save')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
