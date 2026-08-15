/*
 * Types du schéma Supabase, au format de `supabase gen types typescript`.
 * Écrits à la main pour refléter supabase/migrations/20260809000000_init_projects.sql
 * — aucun projet Supabase Eklio n'était accessible depuis cet environnement
 * pour lancer la génération automatique (voir NOTES.md). À régénérer avec la
 * CLI dès que le projet distant est branché.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ProjectStatus = "brief" | "brief_complete" | "directions" | "kit";

export type Database = {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          metier: string | null;
          status: ProjectStatus;
          current_step: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          metier?: string | null;
          status?: ProjectStatus;
          current_step?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          metier?: string | null;
          status?: ProjectStatus;
          current_step?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_briefs: {
        Row: {
          project_id: string;
          data: Json;
          completed_steps: number[];
          updated_at: string;
        };
        Insert: {
          project_id: string;
          data?: Json;
          completed_steps?: number[];
          updated_at?: string;
        };
        Update: {
          project_id?: string;
          data?: Json;
          completed_steps?: number[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_briefs_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: true;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      directions: {
        Row: {
          id: string;
          project_id: string;
          position: number;
          name: string;
          description: string;
          palette: Json;
          typographie_titre: string;
          typographie_corps: string;
          is_selected: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          position: number;
          name: string;
          description: string;
          palette: Json;
          typographie_titre: string;
          typographie_corps: string;
          is_selected?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          position?: number;
          name?: string;
          description?: string;
          palette?: Json;
          typographie_titre?: string;
          typographie_corps?: string;
          is_selected?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "directions_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
