import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FormBuilderClient } from './form-builder-client'

export default async function FormBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: form } = await supabase.from('forms').select('*').eq('id', id).single()
  if (!form) notFound()

  return <FormBuilderClient initialForm={form} />
}
