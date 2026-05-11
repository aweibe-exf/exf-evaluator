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

  // Fetch all forms (any status) — reports pull from historical data, not just active forms
  const { data: forms } = await supabase
    .from('forms')
    .select('id, name, settings')
    .eq('program_id', report.program_id)
    .order('name')

  const formRows = (forms ?? []).map(f => ({
    id: f.id,
    name: f.name,
    settings: f.settings as Record<string, unknown> | null,
  }))

  return <ReportEditorClient initialReport={report} forms={formRows} />
}
