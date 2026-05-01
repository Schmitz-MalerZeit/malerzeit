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
      hourly_rates: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          label: string
          rate: number
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          label: string
          rate?: number
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          rate?: number
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pdf_usage: {
        Row: {
          count: number
          created_at: string | null
          id: string
          period_start: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          count?: number
          created_at?: string | null
          id?: string
          period_start: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          count?: number
          created_at?: string | null
          id?: string
          period_start?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          address_line2: string | null
          city: string | null
          company_name: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          logo_primary_color: string | null
          logo_secondary_color: string | null
          logo_url: string | null
          phone: string | null
          postal_code: string | null
          signatory_name: string | null
          trial_ends_at: string | null
          updated_at: string
          vat_id: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          address_line2?: string | null
          city?: string | null
          company_name?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id: string
          logo_primary_color?: string | null
          logo_secondary_color?: string | null
          logo_url?: string | null
          phone?: string | null
          postal_code?: string | null
          signatory_name?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          vat_id?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          address_line2?: string | null
          city?: string | null
          company_name?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_primary_color?: string | null
          logo_secondary_color?: string | null
          logo_url?: string | null
          phone?: string | null
          postal_code?: string | null
          signatory_name?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          vat_id?: string | null
          website?: string | null
        }
        Relationships: []
      }
      quotes: {
        Row: {
          created_at: string
          customer_address: string | null
          customer_city: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          customer_postal_code: string | null
          customer_text: string | null
          description: string | null
          estimated_hours: number | null
          estimated_material: number | null
          gross_amount: number
          id: string
          line_items: Json
          net_amount: number
          pdf_created_at: string | null
          pdf_filename: string | null
          pdf_mime_type: string | null
          pdf_size_bytes: number | null
          pdf_storage_path: string | null
          title: string
          updated_at: string
          user_id: string
          vat_amount: number
          vat_rate: number
          whatsapp_text: string | null
        }
        Insert: {
          created_at?: string
          customer_address?: string | null
          customer_city?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_postal_code?: string | null
          customer_text?: string | null
          description?: string | null
          estimated_hours?: number | null
          estimated_material?: number | null
          gross_amount?: number
          id?: string
          line_items?: Json
          net_amount?: number
          pdf_created_at?: string | null
          pdf_filename?: string | null
          pdf_mime_type?: string | null
          pdf_size_bytes?: number | null
          pdf_storage_path?: string | null
          title?: string
          updated_at?: string
          user_id: string
          vat_amount?: number
          vat_rate?: number
          whatsapp_text?: string | null
        }
        Update: {
          created_at?: string
          customer_address?: string | null
          customer_city?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_postal_code?: string | null
          customer_text?: string | null
          description?: string | null
          estimated_hours?: number | null
          estimated_material?: number | null
          gross_amount?: number
          id?: string
          line_items?: Json
          net_amount?: number
          pdf_created_at?: string | null
          pdf_filename?: string | null
          pdf_mime_type?: string | null
          pdf_size_bytes?: number | null
          pdf_storage_path?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          vat_amount?: number
          vat_rate?: number
          whatsapp_text?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id?: string
          paddle_subscription_id?: string
          price_id?: string
          product_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          closing_text: string
          created_at: string
          email_template: string
          hourly_rate: number
          material_markup: number
          quality_level: string
          quote_validity_days: number
          updated_at: string
          user_id: string
          vat_rate: number
          whatsapp_template: string
        }
        Insert: {
          closing_text?: string
          created_at?: string
          email_template?: string
          hourly_rate?: number
          material_markup?: number
          quality_level?: string
          quote_validity_days?: number
          updated_at?: string
          user_id: string
          vat_rate?: number
          whatsapp_template?: string
        }
        Update: {
          closing_text?: string
          created_at?: string
          email_template?: string
          hourly_rate?: number
          material_markup?: number
          quality_level?: string
          quote_validity_days?: number
          updated_at?: string
          user_id?: string
          vat_rate?: number
          whatsapp_template?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_pdf_quota: { Args: never; Returns: Json }
      get_pdf_limit: { Args: { price_id: string }; Returns: number }
      get_trial_status: { Args: never; Returns: Json }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      reset_my_pdf_quota: { Args: never; Returns: Json }
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
