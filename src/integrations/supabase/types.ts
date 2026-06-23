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
      achievements: {
        Row: {
          code: string
          criteria_type: string
          criteria_value: number
          description: string
          icon: string
          id: string
          name: string
        }
        Insert: {
          code: string
          criteria_type: string
          criteria_value: number
          description: string
          icon: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          criteria_type?: string
          criteria_value?: number
          description?: string
          icon?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      exercises: {
        Row: {
          category: string
          created_at: string
          default_reps: number
          default_sets: number
          id: string
          is_global: boolean
          name: string
          user_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          default_reps?: number
          default_sets?: number
          id?: string
          is_global?: boolean
          name: string
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          default_reps?: number
          default_sets?: number
          id?: string
          is_global?: boolean
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      goals: {
        Row: {
          created_at: string
          exercise_id: string | null
          goal_type: string
          id: string
          notes: string | null
          parent_goal_id: string | null
          process_period: string | null
          process_target_count: number | null
          reminder_cadence: string | null
          reminder_enabled: boolean
          session_type: string | null
          start_date: string
          status: string
          target_date: string | null
          target_reps: number | null
          target_unit: string
          target_value: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exercise_id?: string | null
          goal_type: string
          id?: string
          notes?: string | null
          parent_goal_id?: string | null
          process_period?: string | null
          process_target_count?: number | null
          reminder_cadence?: string | null
          reminder_enabled?: boolean
          session_type?: string | null
          start_date?: string
          status?: string
          target_date?: string | null
          target_reps?: number | null
          target_unit: string
          target_value: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          exercise_id?: string | null
          goal_type?: string
          id?: string
          notes?: string | null
          parent_goal_id?: string | null
          process_period?: string | null
          process_target_count?: number | null
          reminder_cadence?: string | null
          reminder_enabled?: boolean
          session_type?: string | null
          start_date?: string
          status?: string
          target_date?: string | null
          target_reps?: number | null
          target_unit?: string
          target_value?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_parent_goal_id_fkey"
            columns: ["parent_goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_reviews: {
        Row: {
          created_at: string
          id: string
          insights: string | null
          month_start: string
          payload: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          insights?: string | null
          month_start: string
          payload: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          insights?: string | null
          month_start?: string
          payload?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          units_distance: string
          units_weight: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          units_distance?: string
          units_weight?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          units_distance?: string
          units_weight?: string
        }
        Relationships: []
      }
      running_sessions: {
        Row: {
          avg_pace_seconds: number
          distance_km: number
          duration_minutes: number
          effort_level: number | null
          id: string
          route_notes: string | null
          workout_id: string
        }
        Insert: {
          avg_pace_seconds: number
          distance_km: number
          duration_minutes: number
          effort_level?: number | null
          id?: string
          route_notes?: string | null
          workout_id: string
        }
        Update: {
          avg_pace_seconds?: number
          distance_km?: number
          duration_minutes?: number
          effort_level?: number | null
          id?: string
          route_notes?: string | null
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "running_sessions_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: true
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      sets: {
        Row: {
          exercise_id: string
          id: string
          notes: string | null
          reps: number | null
          rpe: number | null
          set_index: number
          weight: number | null
          workout_id: string
        }
        Insert: {
          exercise_id: string
          id?: string
          notes?: string | null
          reps?: number | null
          rpe?: number | null
          set_index?: number
          weight?: number | null
          workout_id: string
        }
        Update: {
          exercise_id?: string
          id?: string
          notes?: string | null
          reps?: number | null
          rpe?: number | null
          set_index?: number
          weight?: number | null
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sets_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sets_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      template_exercises: {
        Row: {
          exercise_id: string
          id: string
          order_index: number
          target_reps: number
          target_sets: number
          template_id: string
        }
        Insert: {
          exercise_id: string
          id?: string
          order_index?: number
          target_reps?: number
          target_sets?: number
          template_id: string
        }
        Update: {
          exercise_id?: string
          id?: string
          order_index?: number
          target_reps?: number
          target_sets?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_exercises_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_id: string
          id: string
          progress: number
          unlocked_at: string | null
          user_id: string
        }
        Insert: {
          achievement_id: string
          id?: string
          progress?: number
          unlocked_at?: string | null
          user_id: string
        }
        Update: {
          achievement_id?: string
          id?: string
          progress?: number
          unlocked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_stats: {
        Row: {
          current_level: number
          current_streak: number
          last_workout_date: string | null
          longest_streak: number
          total_sessions: number
          total_xp: number
          user_id: string
        }
        Insert: {
          current_level?: number
          current_streak?: number
          last_workout_date?: string | null
          longest_streak?: number
          total_sessions?: number
          total_xp?: number
          user_id: string
        }
        Update: {
          current_level?: number
          current_streak?: number
          last_workout_date?: string | null
          longest_streak?: number
          total_sessions?: number
          total_xp?: number
          user_id?: string
        }
        Relationships: []
      }
      weekly_quests: {
        Row: {
          completed: boolean
          description: string
          id: string
          progress: number
          target: number
          user_id: string
          week_start: string
        }
        Insert: {
          completed?: boolean
          description: string
          id?: string
          progress?: number
          target: number
          user_id: string
          week_start: string
        }
        Update: {
          completed?: boolean
          description?: string
          id?: string
          progress?: number
          target?: number
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      workout_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_global: boolean
          name: string
          session_type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_global?: boolean
          name: string
          session_type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_global?: boolean
          name?: string
          session_type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      workouts: {
        Row: {
          cold_exposure_done: boolean
          created_at: string
          date: string
          duration_minutes: number | null
          energy_level: number | null
          had_pr: boolean
          id: string
          notes: string | null
          session_type: string
          sunlight_done: boolean
          template_id: string | null
          user_id: string
          xp_awarded: number
        }
        Insert: {
          cold_exposure_done?: boolean
          created_at?: string
          date?: string
          duration_minutes?: number | null
          energy_level?: number | null
          had_pr?: boolean
          id?: string
          notes?: string | null
          session_type: string
          sunlight_done?: boolean
          template_id?: string | null
          user_id: string
          xp_awarded?: number
        }
        Update: {
          cold_exposure_done?: boolean
          created_at?: string
          date?: string
          duration_minutes?: number | null
          energy_level?: number | null
          had_pr?: boolean
          id?: string
          notes?: string | null
          session_type?: string
          sunlight_done?: boolean
          template_id?: string | null
          user_id?: string
          xp_awarded?: number
        }
        Relationships: [
          {
            foreignKeyName: "workouts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
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
