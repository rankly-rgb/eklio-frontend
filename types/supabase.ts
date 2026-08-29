/*
 * Types du schéma Supabase — GÉNÉRÉ, ne pas éditer à la main au-dessus de
 * l'addendum en bas de fichier.
 *
 * Source : projet US `eklio-backend-us` (ref fobgdsupyfslxbswfuay, us-east-1),
 * dont le schéma est porté par le repo `eklio-backend` (source de vérité).
 *
 * Régénérer avec :
 *   npx --yes supabase@latest gen types typescript \
 *     --project-id fobgdsupyfslxbswfuay > types/supabase.ts
 * puis réappliquer l'addendum en fin de fichier.
 *
 * `--yes` n'est PAS décoratif. Sans lui, npx pose sa question d'installation
 * sur la sortie STANDARD, et la redirection l'écrit dans le fichier :
 *   Need to install the following packages:
 *   supabase@2.116.0
 *   Ok to proceed? (y) export type Json =
 * Le fichier ne compile alors plus dès sa première ligne, et `tsc` comme
 * `eslint` s'arrêtent là — c'est arrivé, et ça a cassé la branche.
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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      brand_kits: {
        Row: {
          content: Json
          created_at: string
          direction_id: string | null
          directions: Json | null
          ethics_check: Json | null
          id: string
          multi_builder_prompt: string | null
          pdf_url: string | null
          practitioner_line: string | null
          project_id: string
          selected_direction_id: string | null
          share_slug: string | null
          site_prompt: string | null
          site_prompt_target: string | null
          social_templates: Json | null
          tier: string
          updated_at: string
          voice_guide: Json | null
        }
        Insert: {
          content?: Json
          created_at?: string
          direction_id?: string | null
          directions?: Json | null
          ethics_check?: Json | null
          id?: string
          multi_builder_prompt?: string | null
          pdf_url?: string | null
          practitioner_line?: string | null
          project_id: string
          selected_direction_id?: string | null
          share_slug?: string | null
          site_prompt?: string | null
          site_prompt_target?: string | null
          social_templates?: Json | null
          tier?: string
          updated_at?: string
          voice_guide?: Json | null
        }
        Update: {
          content?: Json
          created_at?: string
          direction_id?: string | null
          directions?: Json | null
          ethics_check?: Json | null
          id?: string
          multi_builder_prompt?: string | null
          pdf_url?: string | null
          practitioner_line?: string | null
          project_id?: string
          selected_direction_id?: string | null
          share_slug?: string | null
          site_prompt?: string | null
          site_prompt_target?: string | null
          social_templates?: Json | null
          tier?: string
          updated_at?: string
          voice_guide?: Json | null
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
      client_persona_cards: {
        Row: {
          active: boolean
          description: string
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          description: string
          id: string
          label: string
          sort_order: number
        }
        Update: {
          active?: boolean
          description?: string
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      directions: {
        Row: {
          body_font: string
          created_at: string
          description: string
          heading_font: string
          id: string
          is_selected: boolean
          name: string
          palette: Json
          position: number
          project_id: string
          updated_at: string
        }
        Insert: {
          body_font: string
          created_at?: string
          description: string
          heading_font: string
          id?: string
          is_selected?: boolean
          name: string
          palette: Json
          position: number
          project_id: string
          updated_at?: string
        }
        Update: {
          body_font?: string
          created_at?: string
          description?: string
          heading_font?: string
          id?: string
          is_selected?: boolean
          name?: string
          palette?: Json
          position?: number
          project_id?: string
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
      ethics_rules: {
        Row: {
          active: boolean
          description: string
          example_forbidden: string
          id: string
          short_label: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          description: string
          example_forbidden: string
          id: string
          short_label: string
          sort_order: number
        }
        Update: {
          active?: boolean
          description?: string
          example_forbidden?: string
          id?: string
          short_label?: string
          sort_order?: number
        }
        Relationships: []
      }
      gain_cards: {
        Row: {
          active: boolean
          description: string
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          description: string
          id: string
          label: string
          sort_order: number
        }
        Update: {
          active?: boolean
          description?: string
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
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
      launch_checklist_items: {
        Row: {
          brand_kit_id: string
          created_at: string
          description: string | null
          done_at: string | null
          id: string
          key: string
          label: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_kit_id: string
          created_at?: string
          description?: string | null
          done_at?: string | null
          id?: string
          key: string
          label: string
          sort_order: number
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_kit_id?: string
          created_at?: string
          description?: string | null
          done_at?: string | null
          id?: string
          key?: string
          label?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "launch_checklist_items_brand_kit_id_fkey"
            columns: ["brand_kit_id"]
            isOneToOne: false
            referencedRelation: "brand_kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "launch_checklist_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      license_types: {
        Row: {
          active: boolean
          description: string
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          description: string
          id: string
          label: string
          sort_order: number
        }
        Update: {
          active?: boolean
          description?: string
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      monthly_presence_content: {
        Row: {
          brand_kit_id: string
          caption: string | null
          created_at: string
          day_of_month: number
          id: string
          month: string
          published_at: string | null
          status: string
          title: string | null
          type: string
          updated_at: string
          user_id: string
          visual_spec: Json | null
        }
        Insert: {
          brand_kit_id: string
          caption?: string | null
          created_at?: string
          day_of_month: number
          id?: string
          month: string
          published_at?: string | null
          status?: string
          title?: string | null
          type: string
          updated_at?: string
          user_id: string
          visual_spec?: Json | null
        }
        Update: {
          brand_kit_id?: string
          caption?: string | null
          created_at?: string
          day_of_month?: number
          id?: string
          month?: string
          published_at?: string | null
          status?: string
          title?: string | null
          type?: string
          updated_at?: string
          user_id?: string
          visual_spec?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_presence_content_brand_kit_id_fkey"
            columns: ["brand_kit_id"]
            isOneToOne: false
            referencedRelation: "brand_kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_presence_content_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      palette_families: {
        Row: {
          active: boolean
          dark_hex: string
          id: string
          label: string
          light_hex: string
          paper_hex: string
          preview_tokens: Json
          primary_hex: string
          secondary_hex: string
          sort_order: number
          swatches: string[]
        }
        Insert: {
          active?: boolean
          dark_hex: string
          id: string
          label: string
          light_hex: string
          paper_hex: string
          preview_tokens: Json
          primary_hex: string
          secondary_hex: string
          sort_order: number
          swatches: string[]
        }
        Update: {
          active?: boolean
          dark_hex?: string
          id?: string
          label?: string
          light_hex?: string
          paper_hex?: string
          preview_tokens?: Json
          primary_hex?: string
          secondary_hex?: string
          sort_order?: number
          swatches?: string[]
        }
        Relationships: []
      }
      primary_actions: {
        Row: {
          active: boolean
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          id: string
          label: string
          sort_order: number
        }
        Update: {
          active?: boolean
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      problem_cards: {
        Row: {
          active: boolean
          description: string
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          description: string
          id: string
          label: string
          sort_order: number
        }
        Update: {
          active?: boolean
          description?: string
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
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
          city: string | null
          client_persona_ids: string[]
          completed_steps: number[]
          data: Json
          gain_card_ids: string[]
          license_type_id: string | null
          palette_family_ids: string[]
          positioning: string | null
          practice_name: string | null
          primary_action_id: string | null
          problem_card_ids: string[]
          progress_step: number
          project_id: string
          site_goal_ids: string[]
          specialty_ids: string[]
          state: string | null
          tone_card_id: string | null
          type_pairing_id: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          client_persona_ids?: string[]
          completed_steps?: number[]
          data?: Json
          gain_card_ids?: string[]
          license_type_id?: string | null
          palette_family_ids?: string[]
          positioning?: string | null
          practice_name?: string | null
          primary_action_id?: string | null
          problem_card_ids?: string[]
          progress_step?: number
          project_id: string
          site_goal_ids?: string[]
          specialty_ids?: string[]
          state?: string | null
          tone_card_id?: string | null
          type_pairing_id?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          client_persona_ids?: string[]
          completed_steps?: number[]
          data?: Json
          gain_card_ids?: string[]
          license_type_id?: string | null
          palette_family_ids?: string[]
          positioning?: string | null
          practice_name?: string | null
          primary_action_id?: string | null
          problem_card_ids?: string[]
          progress_step?: number
          project_id?: string
          site_goal_ids?: string[]
          specialty_ids?: string[]
          state?: string | null
          tone_card_id?: string | null
          type_pairing_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_briefs_license_type_id_fkey"
            columns: ["license_type_id"]
            isOneToOne: false
            referencedRelation: "license_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_briefs_primary_action_id_fkey"
            columns: ["primary_action_id"]
            isOneToOne: false
            referencedRelation: "primary_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_briefs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_briefs_tone_card_id_fkey"
            columns: ["tone_card_id"]
            isOneToOne: false
            referencedRelation: "tone_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_briefs_type_pairing_id_fkey"
            columns: ["type_pairing_id"]
            isOneToOne: false
            referencedRelation: "type_pairings"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          current_step: number
          id: string
          name: string
          profession: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_step?: number
          id?: string
          name?: string
          profession?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_step?: number
          id?: string
          name?: string
          profession?: string | null
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
      site_goals: {
        Row: {
          active: boolean
          description: string
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          description: string
          id: string
          label: string
          sort_order: number
        }
        Update: {
          active?: boolean
          description?: string
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      specialties: {
        Row: {
          active: boolean
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          id: string
          label: string
          sort_order: number
        }
        Update: {
          active?: boolean
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
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
          active: boolean | null
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
          active?: boolean | null
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
          active?: boolean | null
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
      tone_cards: {
        Row: {
          active: boolean
          id: string
          keywords: string[]
          sample_hero: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          id: string
          keywords: string[]
          sample_hero: string
          sort_order: number
        }
        Update: {
          active?: boolean
          id?: string
          keywords?: string[]
          sample_hero?: string
          sort_order?: number
        }
        Relationships: []
      }
      type_pairings: {
        Row: {
          active: boolean
          body_font: string
          google_fonts_url: string
          heading_font: string
          id: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          body_font: string
          google_fonts_url: string
          heading_font: string
          id: string
          sort_order: number
        }
        Update: {
          active?: boolean
          body_font?: string
          google_fonts_url?: string
          heading_font?: string
          id?: string
          sort_order?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      brand_kit_directions_contrasted: { Args: { p: Json }; Returns: boolean }
      brand_kit_directions_rendering_valid: {
        Args: { p: Json }
        Returns: boolean
      }
      brand_kit_directions_shape_valid: { Args: { p: Json }; Returns: boolean }
      brand_kit_ethics_check_valid: { Args: { p: Json }; Returns: boolean }
      brand_kit_hero_valid: { Args: { p: Json }; Returns: boolean }
      brand_kit_palette_valid: { Args: { p: Json }; Returns: boolean }
      brand_kit_selection_valid: {
        Args: { p_directions: Json; p_selected: string }
        Returns: boolean
      }
      brand_kit_social_templates_rendering_valid: {
        Args: { p: Json }
        Returns: boolean
      }
      brand_kit_social_templates_shape_valid: {
        Args: { p: Json }
        Returns: boolean
      }
      brand_kit_voice_guide_valid: { Args: { p: Json }; Returns: boolean }
      brief_preview: { Args: { p_brief_id: string }; Returns: Json }
      calendar_summary: {
        Args: { p_month: string; p_user_id: string }
        Returns: Json
      }
      complete_choose_direction: {
        Args: { p_brand_kit_id: string }
        Returns: undefined
      }
      /*
       * AJOUT MANUEL — le compteur de générations, atomique.
       *
       * Consomme une unité et renvoie `false` quand l'allocation est épuisée.
       * L'atomicité est TOUT l'intérêt : lire un compteur puis décider laisse
       * deux POST concurrents lire le même nombre et passer tous les deux.
       */
      consume_generation_credit: {
        Args: { p_brand_kit_id: string }
        Returns: boolean
      }
      ensure_month_skeleton: {
        Args: { p_month: string; p_user_id: string }
        Returns: number
      }
      seed_launch_checklist: {
        Args: { p_brand_kit_id: string }
        Returns: number
      }
      /* ------------------------------------------------------------------
       * AJOUT MANUEL — les huit entrées de l'éditeur de site (§1 du
       * FRONTEND_CONTRACT). Elles sont arrivées en base après la dernière
       * génération de ce fichier ; sans elles, `supabase.rpc("site_spec_get")`
       * ne compile pas. À la prochaine régénération, ce bloc disparaît de
       * lui-même — il ne fait que déclarer ce que la base expose déjà.
       *
       * Toutes renvoient du `Json` : six d'entre elles la MÊME enveloppe
       * (`SiteSpecEnvelope`), `site_output_get` la sortie seule,
       * `site_catalog` le catalogue. Le resserrement de type se fait dans
       * `lib/site/rpc.ts`, pas ici : ce fichier suit la base.
       * ---------------------------------------------------------------- */
      site_catalog: { Args: Record<PropertyKey, never>; Returns: Json }
      site_output_get: {
        Args: { p_brand_kit_id: string; p_format?: string; p_target: string }
        Returns: Json
      }
      site_output_mark_copied: {
        Args: { p_brand_kit_id: string }
        Returns: Json
      }
      site_spec_fix_contrast: {
        Args: { p_brand_kit_id: string; p_pair_id: string }
        Returns: Json
      }
      site_spec_get: { Args: { p_brand_kit_id: string }; Returns: Json }
      site_spec_patch: {
        Args: { p_brand_kit_id: string; p_patch: Json }
        Returns: Json
      }
      site_spec_reset: {
        Args: { p_brand_kit_id: string; p_scope: string }
        Returns: Json
      }
      site_spec_set_target: {
        Args: { p_brand_kit_id: string; p_target: string }
        Returns: Json
      }
      truncate_on_word_boundary: {
        Args: { p_max: number; p_text: string }
        Returns: string
      }
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
 * mappings. Elles doivent rester synchronisées avec les contraintes en base —
 * vérifiées contre `pg_constraint` le 2026-08-27 :
 *
 *   projects.status                  = ANY (ARRAY['brief','brief_complete','directions','kit'])
 *   subscriptions.status             = ANY (ARRAY['incomplete','incomplete_expired','trialing',
 *                                                 'active','past_due','canceled','unpaid','paused'])
 *   purchases.status                 = ANY (ARRAY['pending','paid','refunded','failed'])
 *   monthly_presence_content.status  = ANY (ARRAY['locked','draft','ready','published'])
 *
 * ATTENTION — `monthly_presence_content.status` A CHANGÉ. Il valait
 * `pending`/`generating`/`complete`/`failed` au Lot 4 ; le schéma backend l'a
 * remplacé par un cycle de publication (`locked`/`draft`/`ready`/`published`),
 * avec de nouvelles colonnes `caption`, `visual_spec` et `published_at`.
 * L'union ci-dessous suit la base, pas l'ancien lot. Le code de génération
 * mensuelle écrit encore `'complete'`, valeur que le CHECK REFUSE désormais :
 * cf. `app/app/projets/[id]/presence/actions.ts`, à reprendre avec le reste de
 * la persistance de Monthly Presence.
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
  | "locked"
  | "draft"
  | "ready"
  | "published"
