'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Database, UserRole } from '@/types/database'

type Program = Database['public']['Tables']['programs']['Row']
type Membership = Database['public']['Tables']['program_memberships']['Row']

interface ProgramContextValue {
  programs: Program[]
  currentProgram: Program | null
  currentRole: UserRole | null
  setCurrentProgram: (program: Program) => void
  loading: boolean
  refetch: () => Promise<void>
}

const ProgramContext = createContext<ProgramContextValue | null>(null)

export function ProgramProvider({ children }: { children: React.ReactNode }) {
  const [programs, setPrograms] = useState<Program[]>([])
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [currentProgram, setCurrentProgramState] = useState<Program | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: memberData } = await supabase
      .from('program_memberships').select('*').eq('user_id', user.id)
    const { data: programData } = await supabase
      .from('programs').select('*').is('archived_at', null)

    const myMemberships: Membership[] = memberData ?? []
    setMemberships(myMemberships)

    const isSuperAdmin = myMemberships.some(m => m.role === 'super_admin')
    const myProgramIds = new Set(myMemberships.map(m => m.program_id))
    const allPrograms: Program[] = programData ?? []
    // Super admins see all programs; others only see their own
    const myPrograms = isSuperAdmin ? allPrograms : allPrograms.filter(p => myProgramIds.has(p.id))
    setPrograms(myPrograms)

    // Restore last selected program from localStorage
    const savedId = typeof window !== 'undefined' ? localStorage.getItem('exf_program_id') : null
    const saved = myPrograms.find(p => p.id === savedId)
    setCurrentProgramState(saved ?? myPrograms[0] ?? null)
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  function setCurrentProgram(program: Program) {
    setCurrentProgramState(program)
    if (typeof window !== 'undefined') {
      localStorage.setItem('exf_program_id', program.id)
    }
  }

  // super_admin is platform-level: if the user has it in any program, they're always super_admin
  const isSuperAdmin = memberships.some(m => m.role === 'super_admin')
  const currentRole: UserRole | null = isSuperAdmin
    ? 'super_admin'
    : currentProgram
      ? (memberships.find(m => m.program_id === currentProgram.id)?.role ?? null)
      : null

  return (
    <ProgramContext.Provider value={{
      programs,
      currentProgram,
      currentRole,
      setCurrentProgram,
      loading,
      refetch: fetchData,
    }}>
      {children}
    </ProgramContext.Provider>
  )
}

export function useProgram() {
  const ctx = useContext(ProgramContext)
  if (!ctx) throw new Error('useProgram must be used within ProgramProvider')
  return ctx
}
