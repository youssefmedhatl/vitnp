import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useT } from '@/lib/i18n'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useErrorText } from '@/lib/errors'
import { useCustomer } from '@/storefront/useCustomer'
import { Button, Input } from '@/components/ui'

export function ProfileSection() {
  const t = useT()
  useDocumentTitle(t('store.accountProfile'))
  const errorText = useErrorText()
  const { data: customer, isLoading } = useCustomer()
  const queryClient = useQueryClient()

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    if (customer) {
      setFullName(customer.full_name)
      setPhone(customer.phone || '')
      setEmail(customer.email || '')
    }
  }, [customer])

  const save = useMutation({
    mutationFn: async () => {
      if (!customer) throw new Error(t('common.error'))
      if (!fullName.trim()) throw new Error(t('customers.errorNameRequired'))
      // RLS forbids changing is_blocked from here — only the fields below.
      const { error } = await supabase
        .from('customers')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
        })
        .eq('id', customer.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      toast.success(t('common.saved'))
      queryClient.invalidateQueries({ queryKey: ['storefront_customer'] })
    },
    onError: (e) => toast.error(errorText(e)),
  })

  if (isLoading) {
    return <p className="text-sm text-moss">{t('common.loading')}</p>
  }

  if (!customer) {
    return <p className="text-sm text-moss">{t('store.noProfileYet')}</p>
  }

  return (
    <div className="max-w-md space-y-4">
      <Input label={t('customers.name')} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      <Input label={t('customers.phone')} dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <Input label={t('customers.email')} type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Button onClick={() => save.mutate()} disabled={save.isPending}>
        {t('common.save')}
      </Button>
    </div>
  )
}
