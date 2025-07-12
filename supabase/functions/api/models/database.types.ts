export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  graphql_public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
        }
        Returns: Json
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
  public: {
    Tables: {
      exercises: {
        Row: {
          description: string | null
          id: string
          name: string
        }
        Insert: {
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      plan_days: {
        Row: {
          description: string | null
          id: string
          name: string
          order_index: number
          plan_id: string
        }
        Insert: {
          description?: string | null
          id?: string
          name: string
          order_index: number
          plan_id: string
        }
        Update: {
          description?: string | null
          id?: string
          name?: string
          order_index?: number
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_days_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_exercise_progressions: {
        Row: {
          consecutive_failures: number
          deload_percentage: number
          deload_strategy: "PROPORTIONAL" | "REFERENCE_SET" | "CUSTOM"
          exercise_id: string
          failure_count_for_deload: number
          id: string
          last_updated: string | null
          plan_id: string
          reference_set_index: number | null
          weight_increment: number
        }
        Insert: {
          consecutive_failures?: number
          deload_percentage?: number
          deload_strategy?: "PROPORTIONAL" | "REFERENCE_SET" | "CUSTOM"
          exercise_id: string
          failure_count_for_deload?: number
          id?: string
          last_updated?: string | null
          plan_id: string
          reference_set_index?: number | null
          weight_increment: number
        }
        Update: {
          consecutive_failures?: number
          deload_percentage?: number
          deload_strategy?: "PROPORTIONAL" | "REFERENCE_SET" | "CUSTOM"
          exercise_id?: string
          failure_count_for_deload?: number
          id?: string
          last_updated?: string | null
          plan_id?: string
          reference_set_index?: number | null
          weight_increment?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_exercise_progressions_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_exercise_progressions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_exercise_sets: {
        Row: {
          expected_reps: number
          expected_weight: number
          id: string
          plan_exercise_id: string
          set_index: number
        }
        Insert: {
          expected_reps: number
          expected_weight: number
          id?: string
          plan_exercise_id: string
          set_index: number
        }
        Update: {
          expected_reps?: number
          expected_weight?: number
          id?: string
          plan_exercise_id?: string
          set_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_exercise_sets_plan_exercise_id_fkey"
            columns: ["plan_exercise_id"]
            isOneToOne: false
            referencedRelation: "plan_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_exercises: {
        Row: {
          exercise_id: string
          id: string
          order_index: number
          plan_day_id: string
        }
        Insert: {
          exercise_id: string
          id?: string
          order_index: number
          plan_day_id: string
        }
        Update: {
          exercise_id?: string
          id?: string
          order_index?: number
          plan_day_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_exercises_plan_day_id_fkey"
            columns: ["plan_day_id"]
            isOneToOne: false
            referencedRelation: "plan_days"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_plan_id: string | null
          ai_suggestions_remaining: number
          created_at: string | null
          first_name: string
          id: string
          updated_at: string | null
        }
        Insert: {
          active_plan_id?: string | null
          ai_suggestions_remaining?: number
          created_at?: string | null
          first_name: string
          id: string
          updated_at?: string | null
        }
        Update: {
          active_plan_id?: string | null
          ai_suggestions_remaining?: number
          created_at?: string | null
          first_name?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_plan_id_fkey"
            columns: ["active_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      session_sets: {
        Row: {
          actual_reps: number | null
          actual_weight: number
          completed_at: string | null
          expected_reps: number | null
          id: string
          plan_exercise_id: string
          session_id: string
          set_index: number
          status: "PENDING" | "COMPLETED" | "FAILED" | "SKIPPED"
        }
        Insert: {
          actual_reps?: number | null
          actual_weight: number
          completed_at?: string | null
          expected_reps?: number | null
          id?: string
          plan_exercise_id: string
          session_id: string
          set_index: number
          status?: "PENDING" | "COMPLETED" | "FAILED" | "SKIPPED"
        }
        Update: {
          actual_reps?: number | null
          actual_weight?: number
          completed_at?: string | null
          expected_reps?: number | null
          id?: string
          plan_exercise_id?: string
          session_id?: string
          set_index?: number
          status?: "PENDING" | "COMPLETED" | "FAILED" | "SKIPPED"
        }
        Relationships: [
          {
            foreignKeyName: "session_series_training_session_id_fkey1"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_sets_plan_exercise_id_fkey"
            columns: ["plan_exercise_id"]
            isOneToOne: false
            referencedRelation: "plan_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_sets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          id: string
          plan_day_id: string | null
          plan_id: string
          session_date: string | null
          status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
          user_id: string
        }
        Insert: {
          id?: string
          plan_day_id?: string | null
          plan_id: string
          session_date?: string | null
          status?: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
          user_id: string
        }
        Update: {
          id?: string
          plan_day_id?: string | null
          plan_id?: string
          session_date?: string | null
          status?: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_plan_day_id_fkey"
            columns: ["plan_day_id"]
            isOneToOne: false
            referencedRelation: "plan_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      replace_collection: {
        Args: {
          p_table_name: string
          p_parent_column: string
          p_parent_id: string
          p_order_column: string
          p_records: Json
        }
        Returns: Json
      }
      replace_collections_batch: {
        Args: {
          p_operations: Json
        }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Tables<
  SchemaName extends keyof Database = "public",
  TableName extends keyof (Database[SchemaName]["Tables"] & Database[SchemaName]["Views"]) = never
> = (Database[SchemaName]["Tables"] &
    Database[SchemaName]["Views"])[TableName] extends { Row: infer R }
  ? R
  : never

export type TablesInsert<
  SchemaName extends keyof Database = "public",
  TableName extends keyof Database[SchemaName]["Tables"] = never
> = Database[SchemaName]["Tables"][TableName] extends { Insert: infer I }
  ? I
  : never

export type TablesUpdate<
  SchemaName extends keyof Database = "public",
  TableName extends keyof Database[SchemaName]["Tables"] = never
> = Database[SchemaName]["Tables"][TableName] extends { Update: infer U }
  ? U
  : never

export type Enums<
  SchemaName extends keyof Database = "public",
  EnumName extends keyof Database[SchemaName]["Enums"] = never
> = Database[SchemaName]["Enums"][EnumName]

export type CompositeTypes<
  SchemaName extends keyof Database = "public",
  CompositeTypeName extends keyof Database[SchemaName]["CompositeTypes"] = never
> = Database[SchemaName]["CompositeTypes"][CompositeTypeName]

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
