import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ReportEditorClient } from './report-editor-client'

export default async function ReportEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: report } = await supabase.from('reports').select('*').eq('id', id).single()
  if (!report) notFound()

  // Fetch available forms for the program
  const { data: forms } = await supabase
    .from('forms')
    .select('id, name')
    .eq('program_id', report.program_id)
    .eq('status', 'active')
    .order('name')

  return <ReportEditorClient initialReport={report} forms={forms ?? []} />
}
