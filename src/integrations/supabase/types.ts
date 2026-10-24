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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      cards: {
        Row: {
          back: string
          box: number
          deck_id: string
          due: number
          front: string
          hint: string | null
          id: string
          lapses: number
          owner_id: string
          reviews: number
          updated_at: number
        }
        Insert: {
          back?: string
          box?: number
          deck_id: string
          due?: number
          front?: string
          hint?: string | null
          id: string
          lapses?: number
          owner_id: string
          reviews?: number
          updated_at?: number
        }
        Update: {
          back?: string
          box?: number
          deck_id?: string
          due?: number
          front?: string
          hint?: string | null
          id?: string
          lapses?: number
          owner_id?: string
          reviews?: number
          updated_at?: number
        }
        Relationships: []
      }
      daily_logs: {
        Row: {
          day: string
          learned: number
          reviewed: number
          user_id: string
        }
        Insert: {
          day: string
          learned?: number
          reviewed?: number
          user_id: string
        }
        Update: {
          day?: string
          learned?: number
          reviewed?: number
          user_id?: string
        }
        Relationships: []
      }
      deck_assignments: {
        Row: {
          id: string
          shared_deck_id: string
          user_id: string | null
        }
        Insert: {
          id?: string
          shared_deck_id: string
          user_id?: string | null
        }
        Update: {
          id?: string
          shared_deck_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deck_assignments_shared_deck_id_fkey"
            columns: ["shared_deck_id"]
            isOneToOne: false
            referencedRelation: "shared_decks"
            referencedColumns: ["id"]
          },
        ]
      }
      decks: {
        Row: {
          created_at: number
          deleted: boolean
          id: string
          name: string
          owner_id: string
          shared_deck_id: string | null
          updated_at: number
        }
        Insert: {
          created_at?: number
          deleted?: boolean
          id: string
          name?: string
          owner_id: string
          shared_deck_id?: string | null
          updated_at?: number
        }
        Update: {
          created_at?: number
          deleted?: boolean
          id?: string
          name?: string
          owner_id?: string
          shared_deck_id?: string | null
          updated_at?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          disabled: boolean
          display_name: string | null
          email: string | null
          id: string
          last_active_at: string | null
        }
        Insert: {
          created_at?: string
          disabled?: boolean
          display_name?: string | null
          email?: string | null
          id: string
          last_active_at?: string | null
        }
        Update: {
          created_at?: string
          disabled?: boolean
          display_name?: string | null
          email?: string | null
          id?: string
          last_active_at?: string | null
        }
        Relationships: []
      }
      shared_cards: {
        Row: {
          back: string
          front: string
          hint: string | null
          id: string
          shared_deck_id: string
        }
        Insert: {
          back?: string
          front?: string
          hint?: string | null
          id?: string
          shared_deck_id: string
        }
        Update: {
          back?: string
          front?: string
          hint?: string | null
          id?: string
          shared_deck_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_cards_shared_deck_id_fkey"
            columns: ["shared_deck_id"]
            isOneToOne: false
            referencedRelation: "shared_decks"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_decks: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          daily_goal: number
          reminder_enabled: boolean
          reminder_time: string
          updated_at: number
          user_id: string
        }
        Insert: {
          daily_goal?: number
          reminder_enabled?: boolean
          reminder_time?: string
          updated_at?: number
          user_id: string
        }
        Update: {
          daily_goal?: number
          reminder_enabled?: boolean
          reminder_time?: string
          updated_at?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_read_shared_deck: {
        Args: { _deck: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_user: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user"],
    },
  },
} as const
