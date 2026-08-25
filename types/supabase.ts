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
          tier: string
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
          tier?: string
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
          tier?: string
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
      monthly_presence_content: {
        Row: {
          content: Json
          created_at: string
          id: string
          month: string
          project_id: string
          status: string
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          month: string
          project_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          month?: string
          project_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_presence_content_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
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
          stripe_customer_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          stripe_customer_id?: string | null
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
      purchases: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          paid_at: string | null
          project_id: string | null
          status: string
          stripe_checkout_session_id: string
          stripe_payment_intent_id: string | null
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          project_id?: string | null
          status?: string
          stripe_checkout_session_id: string
          stripe_payment_intent_id?: string | null
          tier: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          project_id?: string | null
          status?: string
          stripe_checkout_session_id?: string
          stripe_payment_intent_id?: string | null
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_events: {
        Row: {
          payload: Json | null
          processed_at: string
          stripe_event_id: string
          type: string
        }
        Insert: {
          payload?: Json | null
          processed_at?: string
          stripe_event_id: string
          type: string
        }
        Update: {
          payload?: Json | null
          processed_at?: string
          stripe_event_id?: string
          type?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          id: string
          status: string
          stripe_price_id: string | null
          stripe_subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          status: string
          stripe_price_id?: string | null
          stripe_subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          status?: string
          stripe_price_id?: string | null
          stripe_subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
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
 * Ces colonnes sont des `text` contraints par un CHECK, pas des enums
 * Postgres : `supabase gen types` les rend donc en `string`. On conserve les
 * unions côté TypeScript pour garder l'exhaustivité dans l'UI et dans les
 * mappings. Elles doivent rester synchronisées avec les contraintes en base.
 *
 *   projects.status                  = ANY (ARRAY['brief','brief_complete','directions','kit'])
 *   subscriptions.status             = ANY (ARRAY['incomplete','incomplete_expired','trialing',
 *                                                 'active','past_due','canceled','unpaid','paused'])
 *   purchases.status                 = ANY (ARRAY['pending','paid','refunded','failed'])
 *   monthly_presence_content.status  = ANY (ARRAY['pending','generating','complete','failed'])
 *
 * `brand_kits.tier` et `purchases.tier` sont eux aussi contraints
 * (starter/practice/signature) mais leur union n'est PAS dupliquée ici : elle
 * vit dans `lib/kit/tiers.ts` (`KIT_TIERS`), qui la tient depuis le Lot 3 et
 * la vérifie contre le type généré.
 * ---------------------------------------------------------------------- */

export type ProjectStatus = "brief" | "brief_complete" | "directions" | "kit"

export type SubscriptionStatus =
  | "incomplete"
  | "incomplete_expired"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "paused"

export type PurchaseStatus = "pending" | "paid" | "refunded" | "failed"

export type MonthlyPresenceStatus =
  | "pending"
  | "generating"
  | "complete"
  | "failed"
