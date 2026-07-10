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
          created_at: string
          criteria: Json
          description: string
          icon: string
          id: string
          title: string
          xp_reward: number
        }
        Insert: {
          code: string
          created_at?: string
          criteria?: Json
          description: string
          icon?: string
          id?: string
          title: string
          xp_reward?: number
        }
        Update: {
          code?: string
          created_at?: string
          criteria?: Json
          description?: string
          icon?: string
          id?: string
          title?: string
          xp_reward?: number
        }
        Relationships: []
      }
      daily_challenges: {
        Row: {
          challenge_date: string
          created_at: string
          difficulty: string
          focus_skill: string | null
          id: string
          topic: string
          xp_reward: number
        }
        Insert: {
          challenge_date: string
          created_at?: string
          difficulty?: string
          focus_skill?: string | null
          id?: string
          topic: string
          xp_reward?: number
        }
        Update: {
          challenge_date?: string
          created_at?: string
          difficulty?: string
          focus_skill?: string | null
          id?: string
          topic?: string
          xp_reward?: number
        }
        Relationships: []
      }
      debate_messages: {
        Row: {
          citations: Json | null
          content: string
          created_at: string
          debate_id: string
          duration_ms: number | null
          fact_checks: Json | null
          id: string
          role: string
          turn_index: number
          user_id: string
        }
        Insert: {
          citations?: Json | null
          content: string
          created_at?: string
          debate_id: string
          duration_ms?: number | null
          fact_checks?: Json | null
          id?: string
          role: string
          turn_index: number
          user_id: string
        }
        Update: {
          citations?: Json | null
          content?: string
          created_at?: string
          debate_id?: string
          duration_ms?: number | null
          fact_checks?: Json | null
          id?: string
          role?: string
          turn_index?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debate_messages_debate_id_fkey"
            columns: ["debate_id"]
            isOneToOne: false
            referencedRelation: "debates"
            referencedColumns: ["id"]
          },
        ]
      }
      debate_scores: {
        Row: {
          coach_plan: Json | null
          created_at: string
          debate_id: string
          delivery_score: number
          evidence_score: number
          fact_accuracy: number
          fallacies: Json | null
          fallacy_penalty: number
          id: string
          logic_score: number
          overall: number
          persuasion_score: number
          strengths: Json | null
          summary: string | null
          user_id: string
          weaknesses: Json | null
          winner: string | null
        }
        Insert: {
          coach_plan?: Json | null
          created_at?: string
          debate_id: string
          delivery_score: number
          evidence_score: number
          fact_accuracy: number
          fallacies?: Json | null
          fallacy_penalty?: number
          id?: string
          logic_score: number
          overall: number
          persuasion_score: number
          strengths?: Json | null
          summary?: string | null
          user_id: string
          weaknesses?: Json | null
          winner?: string | null
        }
        Update: {
          coach_plan?: Json | null
          created_at?: string
          debate_id?: string
          delivery_score?: number
          evidence_score?: number
          fact_accuracy?: number
          fallacies?: Json | null
          fallacy_penalty?: number
          id?: string
          logic_score?: number
          overall?: number
          persuasion_score?: number
          strengths?: Json | null
          summary?: string | null
          user_id?: string
          weaknesses?: Json | null
          winner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debate_scores_debate_id_fkey"
            columns: ["debate_id"]
            isOneToOne: true
            referencedRelation: "debates"
            referencedColumns: ["id"]
          },
        ]
      }
      debates: {
        Row: {
          ai_persona: string
          completed_at: string | null
          created_at: string
          difficulty: string
          format: string
          id: string
          max_turns: number
          overall_score: number | null
          seconds_per_turn: number
          status: string
          topic: string
          updated_at: string
          user_id: string
          user_stance: string
        }
        Insert: {
          ai_persona?: string
          completed_at?: string | null
          created_at?: string
          difficulty?: string
          format?: string
          id?: string
          max_turns?: number
          overall_score?: number | null
          seconds_per_turn?: number
          status?: string
          topic: string
          updated_at?: string
          user_id: string
          user_stance: string
        }
        Update: {
          ai_persona?: string
          completed_at?: string | null
          created_at?: string
          difficulty?: string
          format?: string
          id?: string
          max_turns?: number
          overall_score?: number | null
          seconds_per_turn?: number
          status?: string
          topic?: string
          updated_at?: string
          user_id?: string
          user_stance?: string
        }
        Relationships: []
      }
      knowledge_docs: {
        Row: {
          chunk: string
          created_at: string
          embedding: string
          id: string
          is_public: boolean
          source: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          chunk: string
          created_at?: string
          embedding: string
          id?: string
          is_public?: boolean
          source?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          chunk?: string
          created_at?: string
          embedding?: string
          id?: string
          is_public?: boolean
          source?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          average_score: number
          created_at: string
          display_name: string | null
          id: string
          last_active_date: string | null
          level: number
          persona: string | null
          streak_days: number
          total_debates: number
          total_wins: number
          updated_at: string
          xp: number
        }
        Insert: {
          avatar_url?: string | null
          average_score?: number
          created_at?: string
          display_name?: string | null
          id: string
          last_active_date?: string | null
          level?: number
          persona?: string | null
          streak_days?: number
          total_debates?: number
          total_wins?: number
          updated_at?: string
          xp?: number
        }
        Update: {
          avatar_url?: string | null
          average_score?: number
          created_at?: string
          display_name?: string | null
          id?: string
          last_active_date?: string | null
          level?: number
          persona?: string | null
          streak_days?: number
          total_debates?: number
          total_wins?: number
          updated_at?: string
          xp?: number
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          consumed_at: string | null
          created_at: string
          difficulty: string
          focus_skill: string | null
          id: string
          rationale: string
          topic: string
          user_id: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          difficulty?: string
          focus_skill?: string | null
          id?: string
          rationale: string
          topic: string
          user_id: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          difficulty?: string
          focus_skill?: string | null
          id?: string
          rationale?: string
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      turn_analyses: {
        Row: {
          clarity_score: number | null
          created_at: string
          debate_id: string
          emotion: Json
          fact_flags: Json
          fallacies: Json
          id: string
          turn_index: number
          user_id: string
        }
        Insert: {
          clarity_score?: number | null
          created_at?: string
          debate_id: string
          emotion?: Json
          fact_flags?: Json
          fallacies?: Json
          id?: string
          turn_index: number
          user_id: string
        }
        Update: {
          clarity_score?: number | null
          created_at?: string
          debate_id?: string
          emotion?: Json
          fact_flags?: Json
          fallacies?: Json
          id?: string
          turn_index?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "turn_analyses_debate_id_fkey"
            columns: ["debate_id"]
            isOneToOne: false
            referencedRelation: "debates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_id: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          id?: string
          unlocked_at?: string
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
      user_challenges: {
        Row: {
          challenge_id: string
          completed_at: string
          debate_id: string | null
          id: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed_at?: string
          debate_id?: string | null
          id?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed_at?: string
          debate_id?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_challenges_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "daily_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_memory: {
        Row: {
          debates_analyzed: number
          preferences: Json
          recurring_fallacies: Json
          strengths: Json
          style_notes: string
          updated_at: string
          user_id: string
          weaknesses: Json
        }
        Insert: {
          debates_analyzed?: number
          preferences?: Json
          recurring_fallacies?: Json
          strengths?: Json
          style_notes?: string
          updated_at?: string
          user_id: string
          weaknesses?: Json
        }
        Update: {
          debates_analyzed?: number
          preferences?: Json
          recurring_fallacies?: Json
          strengths?: Json
          style_notes?: string
          updated_at?: string
          user_id?: string
          weaknesses?: Json
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      xp_events: {
        Row: {
          amount: number
          created_at: string
          debate_id: string | null
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          debate_id?: string | null
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          debate_id?: string | null
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      leaderboard: {
        Row: {
          avatar_url: string | null
          average_score: number | null
          display_name: string | null
          id: string | null
          rank: number | null
          total_debates: number | null
          total_wins: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_knowledge: {
        Args: {
          match_count?: number
          query_embedding: string
          requesting_user?: string
        }
        Returns: {
          chunk: string
          id: string
          similarity: number
          source: string
          title: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
