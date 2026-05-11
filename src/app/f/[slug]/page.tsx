import { createServiceClient } from '@/lib/supabase/server'
import { FormRenderer } from './form-renderer-client'
import type { FormSchema } from '@/types/forms'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ token?: string }>
}

export default async function PublicFormPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { token } = await searchParams
  const service = createServiceClient()

  if (!token) {
    return <ErrorPage message="No access token provided. Please use the link from your invitation email." />
  }

  // Load form by slug
  const { data: form } = await service
    .from('forms')
    .select('*, programs(name, brand_color)')
    .eq('slug', slug)
    .single()

  if (!form || form.status !== 'active') {
    return <ErrorPage message="This form is not currently available." />
  }

  // Validate token
  const { data: tokenRow } = await service
    .from('submission_tokens')
    .select('*')
    .eq('token', token)
    .eq('form_id', form.id)
    .single()

  if (!tokenRow) return <ErrorPage message="Invalid or expired link. Please contact the sender." />
  if (tokenRow.used_at) return <ErrorPage message="This link has already been used. Each link can only be used once." />
  if (new Date(tokenRow.expires_at) < new Date()) return <ErrorPage message="This link has expired. Please contact the sender for a new one." />

  const program = form.programs as { name: string; brand_color: string | null } | null
  const schema = form.schema as unknown as FormSchema

  return (
    <FormRenderer
      formId={form.id}
      formName={form.name}
      schema={schema}
      token={token}
      tokenId={tokenRow.id}
      tokenMetadata={(tokenRow.metadata ?? {}) as Record<string, unknown>}
      respondentEmail={tokenRow.email}
      programName={program?.name ?? 'Extension Foundation'}
      brandColor={program?.brand_color ?? '#ea580c'}
      confirmationMessage={(form.settings as Record<string, unknown> | null)?.confirmation_message as string | undefined}
      redirectUrl={(form.settings as Record<string, unknown> | null)?.redirect_url as string | undefined}
    />
  )
}

function ErrorPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-[18px] font-semibold text-gray-800 mb-2">Form unavailable</h1>
        <p className="text-[14px] text-gray-500">{message}</p>
      </div>
    </div>
  )
}
