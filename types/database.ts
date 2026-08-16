/**
 * Types for the Eklio Supabase schema.
 *
 * Hand-written to mirror `supabase/migrations/`. Regenerate with
 * `supabase gen types typescript` once the CLI is available in this
 * environment — the migrations, not this file, are the source of truth.
 *
 * The `Relationships` array on every table is not decoration: postgrest-js
 * requires it to satisfy `GenericTable`, and without it the whole `Database`
 * generic silently degrades and every query result types as `never`.
 */

import type { BriefStepId } from "@/lib/brief/steps";

export type ProjectStatus =
  | "brief"
  | "brief_complete"
  | "directions"
  | "kit";

/** Matches the `brief_step` enum; kept aligned with lib/brief/steps.ts. */
export type BriefStep = BriefStepId;

export type DirectionPalette = {
  primary: string;
  secondary: string;
  accent: string;
  light_neutral: string;
  dark_neutral: string;
};

/** Real font names chosen by the model — proper nouns, never translated. */
export type DirectionTypography = {
  headings: string;
  body: string;
};

export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

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
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: "projects_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: "brief_answers_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
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
          palette: DirectionPalette;
          typography: DirectionTypography;
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
          palette: DirectionPalette;
          typography: DirectionTypography;
          is_selected?: boolean;
        };
        Update: {
          name?: string;
          description?: string;
          palette?: DirectionPalette;
          typography?: DirectionTypography;
          is_selected?: boolean;
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
    Enums: {
      project_status: ProjectStatus;
      brief_step: BriefStep;
    };
  };
};
