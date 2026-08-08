/**
 * Types du schéma Supabase Eklio. Écrits à la main pour refléter
 * supabase/migrations/20260808000000_init_schema.sql (eklio-backend) —
 * à régénérer avec la CLI Supabase (`supabase gen types typescript`) dès
 * qu'elle est accessible dans cet environnement, pour rester la source de
 * vérité automatique après chaque nouvelle migration.
 */

export type ProjectStatus = "brief" | "directions" | "kit" | "completed";
export type BriefStep =
  | "brief"
  | "positionnement"
  | "audience"
  | "ton"
  | "palette"
  | "typographies"
  | "site";
export type DirectionStatus = "generating" | "ready" | "failed";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
        };
        Update: {
          email?: string;
          full_name?: string | null;
        };
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          status: ProjectStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name?: string;
          status?: ProjectStatus;
        };
        Update: {
          name?: string;
          status?: ProjectStatus;
        };
      };
      brief_answers: {
        Row: {
          id: string;
          project_id: string;
          step: BriefStep;
          answer: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          step: BriefStep;
          answer?: Record<string, unknown>;
        };
        Update: {
          answer?: Record<string, unknown>;
        };
      };
      directions: {
        Row: {
          id: string;
          project_id: string;
          position: number;
          name: string | null;
          summary: string | null;
          palette: Record<string, unknown>;
          typography: Record<string, unknown>;
          tone_descriptors: unknown[];
          status: DirectionStatus;
          is_selected: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          position: number;
          name?: string | null;
          summary?: string | null;
          palette?: Record<string, unknown>;
          typography?: Record<string, unknown>;
          tone_descriptors?: unknown[];
          status?: DirectionStatus;
          is_selected?: boolean;
        };
        Update: {
          name?: string | null;
          summary?: string | null;
          palette?: Record<string, unknown>;
          typography?: Record<string, unknown>;
          tone_descriptors?: unknown[];
          status?: DirectionStatus;
          is_selected?: boolean;
        };
      };
      brand_kits: {
        Row: {
          id: string;
          project_id: string;
          direction_id: string;
          content: Record<string, unknown>;
          multi_builder_prompt: string | null;
          pdf_url: string | null;
          share_slug: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          direction_id: string;
          content?: Record<string, unknown>;
          multi_builder_prompt?: string | null;
          pdf_url?: string | null;
          share_slug?: string | null;
        };
        Update: {
          content?: Record<string, unknown>;
          multi_builder_prompt?: string | null;
          pdf_url?: string | null;
          share_slug?: string | null;
        };
      };
      generation_credits: {
        Row: {
          id: string;
          project_id: string;
          directions_generated: number;
          directions_limit: number;
          regenerations_used: number;
          regenerations_limit: number;
          has_paid: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          directions_generated?: number;
          directions_limit?: number;
          regenerations_used?: number;
          regenerations_limit?: number;
          has_paid?: boolean;
        };
        Update: {
          directions_generated?: number;
          directions_limit?: number;
          regenerations_used?: number;
          regenerations_limit?: number;
          has_paid?: boolean;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
