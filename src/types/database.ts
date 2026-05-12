export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_summaries: {
        Row: {
          content: string
          created_at: string
          date_from: string
          date_to: string
          form_id: string | null
          id: string
          model_version: string
          program_id: string
          summary_type: Database["public"]["Enums"]["summary_type"]
        }
        Insert: {
          content: string
          created_at?: string
          date_from: string
          date_to: string
          form_id?: string | null
          id?: string
          model_version?: string
          program_id: string
          summary_type: Database["public"]["Enums"]["summary_type"]
        }
        Update: {
          content?: string
          created_at?: string
          date_from?: string
          date_to?: string
          form_id?: string | null
          id?: string
          model_version?: string
          program_id?: string
          summary_type?: Database["public"]["Enums"]["summary_type"]
        }
        Relationships: [
          {
            foreignKeyName: "ai_summaries_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_summaries_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          diff: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          program_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          diff?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          program_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          diff?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          program_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      form_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_archived: boolean
          is_global: boolean
          name: string
          program_id: string | null
          schema: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean
          is_global?: boolean
          name: string
          program_id?: string | null
          schema?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean
          is_global?: boolean
          name?: string
          program_id?: string | null
          schema?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_templates_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          program_id: string
          schema: Json
          settings: Json
          slug: string
          status: Database["public"]["Enums"]["form_status"]
          template_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          program_id: string
          schema?: Json
          settings?: Json
          slug: string
          status?: Database["public"]["Enums"]["form_status"]
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          program_id?: string
          schema?: Json
          settings?: Json
          slug?: string
          status?: Database["public"]["Enums"]["form_status"]
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forms_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forms_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "form_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          column_mappings: Json | null
          created_at: string
          created_by: string | null
          detected_schema: Json | null
          error_log: string | null
          file_name: string
          file_url: string
          id: string
          imported_count: number | null
          preview_data: Json | null
          program_id: string
          row_count: number | null
          status: Database["public"]["Enums"]["import_status"]
          updated_at: string
        }
        Insert: {
          column_mappings?: Json | null
          created_at?: string
          created_by?: string | null
          detected_schema?: Json | null
          error_log?: string | null
          file_name: string
          file_url: string
          id?: string
          imported_count?: number | null
          preview_data?: Json | null
          program_id: string
          row_count?: number | null
          status?: Database["public"]["Enums"]["import_status"]
          updated_at?: string
        }
        Update: {
          column_mappings?: Json | null
          created_at?: string
          created_by?: string | null
          detected_schema?: Json | null
          error_log?: string | null
          file_name?: string
          file_url?: string
          id?: string
          imported_count?: number | null
          preview_data?: Json | null
          program_id?: string
          row_count?: number | null
          status?: Database["public"]["Enums"]["import_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_memberships: {
        Row: {
          created_at: string
          id: string
          program_id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          program_id: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          program_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_memberships_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_visualizations: {
        Row: {
          id: string
          program_id: string
          created_by: string
          created_by_email: string | null
          title: string
          description: string | null
          prompt: string
          config: Json
          created_at: string
        }
        Insert: {
          id?: string
          program_id: string
          created_by: string
          created_by_email?: string | null
          title: string
          description?: string | null
          prompt: string
          config: Json
          created_at?: string
        }
        Update: {
          title?: string
          description?: string | null
        }
        Relationships: []
      }
      pulse_notes: {
        Row: {
          id: string
          program_id: string
          author_id: string
          author_email: string | null
          title: string | null
          content: string
          source: string
          note_date: string
          google_doc_url: string | null
          attachments: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          program_id: string
          author_id: string
          author_email?: string | null
          title?: string | null
          content?: string
          source?: string
          note_date?: string
          google_doc_url?: string | null
          attachments?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          program_id?: string
          author_id?: string
          author_email?: string | null
          title?: string | null
          content?: string
          source?: string
          note_date?: string
          google_doc_url?: string | null
          attachments?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      program_narratives: {
        Row: {
          id: string
          program_id: string
          title: string
          description: string | null
          content: string
          file_name: string | null
          document_type: string
          starts_at: string
          ends_at: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          program_id: string
          title: string
          description?: string | null
          content: string
          file_name?: string | null
          document_type?: string
          starts_at: string
          ends_at: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          program_id?: string
          title?: string
          description?: string | null
          content?: string
          file_name?: string | null
          document_type?: string
          starts_at?: string
          ends_at?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      programs: {
        Row: {
          archived_at: string | null
          brand_color: string | null
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          slug: string
        }
        Insert: {
          archived_at?: string | null
          brand_color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          slug: string
        }
        Update: {
          archived_at?: string | null
          brand_color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          content: Json
          created_at: string
          created_by: string | null
          date_from: string
          date_to: string
          exported_at: string | null
          id: string
          name: string
          program_id: string
          status: Database["public"]["Enums"]["report_status"]
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          created_by?: string | null
          date_from: string
          date_to: string
          exported_at?: string | null
          id?: string
          name: string
          program_id: string
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          created_by?: string | null
          date_from?: string
          date_to?: string
          exported_at?: string | null
          id?: string
          name?: string
          program_id?: string
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          form_id: string
          id: string
          metadata: Json
          sent_at: string | null
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          expires_at?: string
          form_id: string
          id?: string
          metadata?: Json
          sent_at?: string | null
          token?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          form_id?: string
          id?: string
          metadata?: Json
          sent_at?: string | null
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submission_tokens_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          created_at: string
          data: Json
          form_id: string
          id: string
          ip_address: unknown
          metadata: Json
          respondent_email: string | null
          status: Database["public"]["Enums"]["submission_status"]
          submitted_at: string | null
          submitted_by: string | null
          token_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          form_id: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          respondent_email?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          token_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          form_id?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          respondent_email?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          token_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "submission_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_program_admin_or_above: {
        Args: { p_program_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
      my_role_in: {
        Args: { p_program_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      form_status: "draft" | "active" | "closed"
      import_status: "pending" | "processing" | "review" | "complete" | "failed"
      report_status: "draft" | "final"
      submission_status: "draft" | "submitted" | "reviewed"
      summary_type: "submission" | "trend" | "impact" | "report_section"
      user_role: "super_admin" | "program_admin" | "staff" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      form_status: ["draft", "active", "closed"],
      import_status: ["pending", "processing", "review", "complete", "failed"],
      report_status: ["draft", "final"],
      submission_status: ["draft", "submitted", "reviewed"],
      summary_type: ["submission", "trend", "impact", "report_section"],
      user_role: ["super_admin", "program_admin", "staff", "viewer"],
    },
  },
} as const

// Convenience type aliases used across the app
export type UserRole = Database['public']['Enums']['user_role']
export type FormStatus = Database['public']['Enums']['form_status']
export type SubmissionStatus = Database['public']['Enums']['submission_status']
export type SummaryType = Database['public']['Enums']['summary_type']
export type ReportStatus = Database['public']['Enums']['report_status']
export type ImportStatus = Database['public']['Enums']['import_status']
