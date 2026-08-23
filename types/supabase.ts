/*
 * Types du schéma Supabase — GÉNÉRÉ, ne pas éditer à la main au-dessus de
 * l'addendum en bas de fichier.
 *
 * Source : projet US `eklio-backend-us` (ref fobgdsupyfslxbswfuay, us-east-1),
 * dont le schéma est porté par le repo `eklio-backend` (source de vérité).
 * Régénérer avec :
 *   supabase gen types typescript --project-id fobgdsupyfslxbswfuay > types/supabase.ts
 * puis réappliquer l'addendum en fin de fichier.
 */

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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      brand_kits: {
        Row: {
          content: Json
          created_at: string
          direction_id: string
          id: string
          multi_builder_prompt: string | null
          pdf_url: string | null
          project_id: string
          share_slug: string | null
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          direction_id: string
          id?: string
          multi_builder_prompt?: string | null
          pdf_url?: string | null
          project_id: string
          share_slug?: string | null
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          direction_id?: string
          id?: string
          multi_builder_prompt?: string | null
          pdf_url?: string | null
          project_id?: string
          share_slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_kits_direction_id_fkey"
            columns: ["direction_id"]
            isOneToOne: false
            referencedRelation: "directions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_kits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      directions: {
        Row: {
          created_at: string
          description: string
          id: string
          is_selected: boolean
          name: string
          palette: Json
          position: number
          project_id: string
          typographie_corps: string
          typographie_titre: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          is_selected?: boolean
          name: string
          palette: Json
          position: number
          project_id: string
          typographie_corps: string
          typographie_titre: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_selected?: boolean
          name?: string
          palette?: Json
          position?: number
          project_id?: string
          typographie_corps?: string
          typographie_titre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "directions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_credits: {
        Row: {
          created_at: string
          directions_generated: number
          directions_limit: number
          has_paid: boolean
          id: string
          project_id: string
          regenerations_limit: number
          regenerations_used: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          directions_generated?: number
          directions_limit?: number
          has_paid?: boolean
          id?: string
          project_id: string
          regenerations_limit?: number
          regenerations_used?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          directions_generated?: number
          directions_limit?: number
          has_paid?: boolean
          id?: string
          project_id?: string
          regenerations_limit?: number
          regenerations_used?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_credits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_briefs: {
        Row: {
          completed_steps: number[]
          data: Json
          project_id: string
          updated_at: string
        }
        Insert: {
          completed_steps?: number[]
          data?: Json
          project_id: string
          updated_at?: string
        }
        Update: {
          completed_steps?: number[]
          data?: Json
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_briefs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          current_step: number
          id: string
          metier: string | null
          name: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_step?: number
          id?: string
          metier?: string | null
          name?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_step?: number
          id?: string
          metier?: string | null
          name?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

/* ------------------------------------------------------------------------
 * ADDENDUM MANUEL — à réappliquer après chaque régénération.
 *
 * `projects.status` est un `text` contraint par un CHECK, pas un enum
 * Postgres : `supabase gen types` le rend donc en `string`. On conserve
 * l'union côté TypeScript pour garder l'exhaustivité des libellés de statut
 * dans l'UI. Elle doit rester synchronisée avec la contrainte en base :
 *   status = ANY (ARRAY['brief','brief_complete','directions','kit'])
 * ---------------------------------------------------------------------- */

export type ProjectStatus = "brief" | "brief_complete" | "directions" | "kit"
