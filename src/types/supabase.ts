export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      color_genie_requests: {
        Row: {
          created_at: string
          duration_ms_embedding: number | null
          duration_ms_supabase: number | null
          id: number
          model: string | null
          query_text: string | null
          top_result_name: string | null
        }
        Insert: {
          created_at?: string
          duration_ms_embedding?: number | null
          duration_ms_supabase?: number | null
          id?: number
          model?: string | null
          query_text?: string | null
          top_result_name?: string | null
        }
        Update: {
          created_at?: string
          duration_ms_embedding?: number | null
          duration_ms_supabase?: number | null
          id?: number
          model?: string | null
          query_text?: string | null
          top_result_name?: string | null
        }
        Relationships: []
      }
      colors: {
        Row: {
          created_at: string | null
          embedding_mistral_1024: string | null
          embedding_openai_1536: string | null
          hex: string | null
          id: number
          is_good_name: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          embedding_mistral_1024?: string | null
          embedding_openai_1536?: string | null
          hex?: string | null
          id?: number
          is_good_name?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          embedding_mistral_1024?: string | null
          embedding_openai_1536?: string | null
          hex?: string | null
          id?: number
          is_good_name?: boolean | null
          name?: string
        }
        Relationships: []
      }
      fonts: {
        Row: {
          ai_descriptors: string | null
          category: string | null
          copyright: string | null
          created_at: string | null
          designer: string | null
          embedding_mistral_v1: string | null
          id: number
          license: string | null
          name: string
          stroke: string | null
          summary_text_v1: string | null
          url: string | null
          year: number | null
        }
        Insert: {
          ai_descriptors?: string | null
          category?: string | null
          copyright?: string | null
          created_at?: string | null
          designer?: string | null
          embedding_mistral_v1?: string | null
          id?: number
          license?: string | null
          name: string
          stroke?: string | null
          summary_text_v1?: string | null
          url?: string | null
          year?: number | null
        }
        Update: {
          ai_descriptors?: string | null
          category?: string | null
          copyright?: string | null
          created_at?: string | null
          designer?: string | null
          embedding_mistral_v1?: string | null
          id?: number
          license?: string | null
          name?: string
          stroke?: string | null
          summary_text_v1?: string | null
          url?: string | null
          year?: number | null
        }
        Relationships: []
      }
      "fonts-old": {
        Row: {
          additional_weights: number[] | null
          category: string | null
          copyright: string | null
          created_at: string | null
          default_weight: number | null
          designer: string | null
          embedding_mistral_v1: string | null
          filename: string | null
          has_italic: boolean | null
          id: number
          is_variable: boolean | null
          license: string | null
          max_weight: number | null
          min_weight: number | null
          name: string
          published_at: string | null
          stroke: string | null
          subsets: string[] | null
          summary_text_v1: string | null
        }
        Insert: {
          additional_weights?: number[] | null
          category?: string | null
          copyright?: string | null
          created_at?: string | null
          default_weight?: number | null
          designer?: string | null
          embedding_mistral_v1?: string | null
          filename?: string | null
          has_italic?: boolean | null
          id?: number
          is_variable?: boolean | null
          license?: string | null
          max_weight?: number | null
          min_weight?: number | null
          name: string
          published_at?: string | null
          stroke?: string | null
          subsets?: string[] | null
          summary_text_v1?: string | null
        }
        Update: {
          additional_weights?: number[] | null
          category?: string | null
          copyright?: string | null
          created_at?: string | null
          default_weight?: number | null
          designer?: string | null
          embedding_mistral_v1?: string | null
          filename?: string | null
          has_italic?: boolean | null
          id?: number
          is_variable?: boolean | null
          license?: string | null
          max_weight?: number | null
          min_weight?: number | null
          name?: string
          published_at?: string | null
          stroke?: string | null
          subsets?: string[] | null
          summary_text_v1?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      search_embedding_mistral_1024: {
        Args: { query_embedding: string; match_count?: number }
        Returns: {
          name: string
          hex: string
          is_good_name: boolean
          distance: number
        }[]
      }
      search_embedding_openai_1536: {
        Args: { query_embedding: string; match_count?: number }
        Returns: {
          name: string
          hex: string
          is_good_name: boolean
          distance: number
        }[]
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
