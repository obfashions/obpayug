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
      api_request_logs: {
        Row: {
          action: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          ip_address: string | null
          merchant_id: string | null
          method: string
          path: string
          status_code: number
        }
        Insert: {
          action?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          merchant_id?: string | null
          method: string
          path: string
          status_code?: number
        }
        Update: {
          action?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          merchant_id?: string | null
          method?: string
          path?: string
          status_code?: number
        }
        Relationships: []
      }
      kyc_documents: {
        Row: {
          created_at: string
          doc_type: string
          file_name: string | null
          file_path: string
          file_size: number | null
          id: string
          merchant_id: string
          status: string
          submission_id: string | null
        }
        Insert: {
          created_at?: string
          doc_type: string
          file_name?: string | null
          file_path: string
          file_size?: number | null
          id?: string
          merchant_id: string
          status?: string
          submission_id?: string | null
        }
        Update: {
          created_at?: string
          doc_type?: string
          file_name?: string | null
          file_path?: string
          file_size?: number | null
          id?: string
          merchant_id?: string
          status?: string
          submission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kyc_documents_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "kyc_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_submissions: {
        Row: {
          address: string | null
          business_name: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          id_number: string | null
          id_type: string | null
          merchant_id: string
          phone: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          id_number?: string | null
          id_type?: string | null
          merchant_id: string
          phone?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          id_number?: string | null
          id_type?: string | null
          merchant_id?: string
          phone?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      merchant_api_keys: {
        Row: {
          created_at: string
          environment: string
          id: string
          last_used_at: string | null
          merchant_id: string
          name: string
          public_key: string
          secret_hash: string
          secret_last4: string
          secret_prefix: string
          status: string
        }
        Insert: {
          created_at?: string
          environment?: string
          id?: string
          last_used_at?: string | null
          merchant_id: string
          name?: string
          public_key: string
          secret_hash: string
          secret_last4: string
          secret_prefix: string
          status?: string
        }
        Update: {
          created_at?: string
          environment?: string
          id?: string
          last_used_at?: string | null
          merchant_id?: string
          name?: string
          public_key?: string
          secret_hash?: string
          secret_last4?: string
          secret_prefix?: string
          status?: string
        }
        Relationships: []
      }
      merchant_balances: {
        Row: {
          available_balance: number
          created_at: string
          currency: string
          id: string
          merchant_id: string
          pending_balance: number
          total_collections: number
          total_payouts: number
          updated_at: string
        }
        Insert: {
          available_balance?: number
          created_at?: string
          currency?: string
          id?: string
          merchant_id: string
          pending_balance?: number
          total_collections?: number
          total_payouts?: number
          updated_at?: string
        }
        Update: {
          available_balance?: number
          created_at?: string
          currency?: string
          id?: string
          merchant_id?: string
          pending_balance?: number
          total_collections?: number
          total_payouts?: number
          updated_at?: string
        }
        Relationships: []
      }
      payment_links: {
        Row: {
          amount: number | null
          created_at: string
          currency: string
          description: string | null
          fixed_amount: boolean
          id: string
          merchant_id: string
          payments_count: number
          redirect_url: string | null
          slug: string
          status: string
          title: string
          updated_at: string
          views: number
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          fixed_amount?: boolean
          id?: string
          merchant_id: string
          payments_count?: number
          redirect_url?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string
          views?: number
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          fixed_amount?: boolean
          id?: string
          merchant_id?: string
          payments_count?: number
          redirect_url?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string
          views?: number
        }
        Relationships: []
      }
      payment_records: {
        Row: {
          amount: number
          created_at: string
          currency: string
          description: string | null
          fee_amount: number
          id: string
          merchant_id: string
          metadata: Json
          net_amount: number | null
          payment_link_id: string | null
          phone_number: string | null
          provider_reference: string | null
          reference: string
          settled_at: string | null
          source: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          description?: string | null
          fee_amount?: number
          id?: string
          merchant_id: string
          metadata?: Json
          net_amount?: number | null
          payment_link_id?: string | null
          phone_number?: string | null
          provider_reference?: string | null
          reference: string
          settled_at?: string | null
          source?: string
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          fee_amount?: number
          id?: string
          merchant_id?: string
          metadata?: Json
          net_amount?: number | null
          payment_link_id?: string | null
          phone_number?: string | null
          provider_reference?: string | null
          reference?: string
          settled_at?: string | null
          source?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_records_payment_link_id_fkey"
            columns: ["payment_link_id"]
            isOneToOne: false
            referencedRelation: "payment_links"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_credentials: {
        Row: {
          api_key: string | null
          api_secret: string | null
          created_at: string
          enabled: boolean
          id: string
          label: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          api_key?: string | null
          api_secret?: string | null
          created_at?: string
          enabled?: boolean
          id: string
          label?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          api_key?: string | null
          api_secret?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          label?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          attempts: number
          created_at: string
          endpoint_id: string | null
          event: string
          id: string
          merchant_id: string
          payload: Json
          response_body: string | null
          response_code: number | null
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          endpoint_id?: string | null
          event: string
          id?: string
          merchant_id: string
          payload?: Json
          response_body?: string | null
          response_code?: number | null
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          endpoint_id?: string | null
          event?: string
          id?: string
          merchant_id?: string
          payload?: Json
          response_body?: string | null
          response_code?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          created_at: string
          events: string[]
          id: string
          merchant_id: string
          secret: string
          status: string
          url: string
        }
        Insert: {
          created_at?: string
          events?: string[]
          id?: string
          merchant_id: string
          secret: string
          status?: string
          url: string
        }
        Update: {
          created_at?: string
          events?: string[]
          id?: string
          merchant_id?: string
          secret?: string
          status?: string
          url?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_merchant_balance_change: {
        Args: {
          p_available_delta: number
          p_collections_delta?: number
          p_currency: string
          p_merchant_id: string
          p_payouts_delta?: number
        }
        Returns: {
          available_balance: number
          created_at: string
          currency: string
          id: string
          merchant_id: string
          pending_balance: number
          total_collections: number
          total_payouts: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "merchant_balances"
          isOneToOne: true
          isSetofReturn: false
        }
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
