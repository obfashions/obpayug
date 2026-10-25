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
    PostgrestVersion: "14.15"
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
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          resource: string | null
          resource_id: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource?: string | null
          resource_id?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource?: string | null
          resource_id?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      company_documents: {
        Row: {
          created_at: string | null
          description: string | null
          document_name: string
          document_type: string
          document_url: string
          id: string
          status: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          document_name: string
          document_type: string
          document_url: string
          id?: string
          status?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          document_name?: string
          document_type?: string
          document_url?: string
          id?: string
          status?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      currency_exchanges: {
        Row: {
          created_at: string
          fee_percent: number
          from_amount: number
          from_currency: string
          id: string
          merchant_id: string
          rate: number
          to_amount: number
          to_currency: string
        }
        Insert: {
          created_at?: string
          fee_percent?: number
          from_amount: number
          from_currency: string
          id?: string
          merchant_id: string
          rate: number
          to_amount: number
          to_currency: string
        }
        Update: {
          created_at?: string
          fee_percent?: number
          from_amount?: number
          from_currency?: string
          id?: string
          merchant_id?: string
          rate?: number
          to_amount?: number
          to_currency?: string
        }
        Relationships: []
      }
      email_campaign_logs: {
        Row: {
          body_preview: string | null
          campaign_type: string
          created_at: string | null
          id: number
          recipient_email: string
          recipient_name: string | null
          sent_at: string | null
          status: string | null
          subject: string
        }
        Insert: {
          body_preview?: string | null
          campaign_type: string
          created_at?: string | null
          id?: number
          recipient_email: string
          recipient_name?: string | null
          sent_at?: string | null
          status?: string | null
          subject: string
        }
        Update: {
          body_preview?: string | null
          campaign_type?: string
          created_at?: string | null
          id?: number
          recipient_email?: string
          recipient_name?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string
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
          account_type: string
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
          account_type?: string
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
          account_type?: string
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
      member_roles: {
        Row: {
          role: string
          user_id: string
        }
        Insert: {
          role: string
          user_id: string
        }
        Update: {
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      merchant_fee_exemptions: {
        Row: {
          created_at: string
          merchant_id: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          merchant_id: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          merchant_id?: string
          reason?: string | null
        }
        Relationships: []
      }
      merchant_payout_preferences: {
        Row: {
          fee_mode: string
          merchant_id: string
          updated_at: string
        }
        Insert: {
          fee_mode?: string
          merchant_id: string
          updated_at?: string
        }
        Update: {
          fee_mode?: string
          merchant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_payout_preferences_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_profiles: {
        Row: {
          business_address: string | null
          company_name: string | null
          country: string | null
          created_at: string | null
          credentials_generated: boolean | null
          id: string
          id_back_url: string | null
          id_front_url: string | null
          merchant_id: string | null
          merchant_slug: string | null
          national_id: string | null
          rejection_reason: string | null
          updated_at: string | null
          user_id: string
          verification_status: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          business_address?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string | null
          credentials_generated?: boolean | null
          id?: string
          id_back_url?: string | null
          id_front_url?: string | null
          merchant_id?: string | null
          merchant_slug?: string | null
          national_id?: string | null
          rejection_reason?: string | null
          updated_at?: string | null
          user_id: string
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          business_address?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string | null
          credentials_generated?: boolean | null
          id?: string
          id_back_url?: string | null
          id_front_url?: string | null
          merchant_id?: string | null
          merchant_slug?: string | null
          national_id?: string | null
          rejection_reason?: string | null
          updated_at?: string | null
          user_id?: string
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_refunds: {
        Row: {
          amount: number
          created_at: string
          currency: string
          error: string | null
          id: string
          merchant_id: string
          original_reference: string
          phone_number: string | null
          reason: string | null
          refund_reference: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          error?: string | null
          id?: string
          merchant_id: string
          original_reference: string
          phone_number?: string | null
          reason?: string | null
          refund_reference: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          error?: string | null
          id?: string
          merchant_id?: string
          original_reference?: string
          phone_number?: string | null
          reason?: string | null
          refund_reference?: string
          status?: string
        }
        Relationships: []
      }
      merchant_signing_secrets: {
        Row: {
          created_at: string
          merchant_id: string
          rotated_at: string | null
          secret: string
        }
        Insert: {
          created_at?: string
          merchant_id: string
          rotated_at?: string | null
          secret: string
        }
        Update: {
          created_at?: string
          merchant_id?: string
          rotated_at?: string | null
          secret?: string
        }
        Relationships: []
      }
      merchant_transfers: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          reason: string
          recipient_balance_after: number
          recipient_balance_before: number
          recipient_id: string
          recipient_name: string
          reference: string
          request_id: string
          sender_balance_after: number
          sender_balance_before: number
          sender_id: string
          sender_name: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          id?: string
          reason: string
          recipient_balance_after: number
          recipient_balance_before: number
          recipient_id: string
          recipient_name: string
          reference: string
          request_id: string
          sender_balance_after: number
          sender_balance_before: number
          sender_id: string
          sender_name: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          reason?: string
          recipient_balance_after?: number
          recipient_balance_before?: number
          recipient_id?: string
          recipient_name?: string
          reference?: string
          request_id?: string
          sender_balance_after?: number
          sender_balance_before?: number
          sender_id?: string
          sender_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_transfers_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_transfers_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_wallets: {
        Row: {
          available_balance: number | null
          balances_by_currency: Json | null
          created_at: string | null
          currency: string | null
          daily_withdrawal_limit: number | null
          id: string
          invested_balance: number | null
          last_24h_withdrawal_total: number | null
          last_withdrawal_reset_at: string | null
          payout_mode: string | null
          pending_balance: number | null
          total_collections: number | null
          total_payouts: number | null
          updated_at: string | null
          user_id: string
          welcome_bonus_credited: boolean | null
          withdrawals_enabled: boolean | null
        }
        Insert: {
          available_balance?: number | null
          balances_by_currency?: Json | null
          created_at?: string | null
          currency?: string | null
          daily_withdrawal_limit?: number | null
          id?: string
          invested_balance?: number | null
          last_24h_withdrawal_total?: number | null
          last_withdrawal_reset_at?: string | null
          payout_mode?: string | null
          pending_balance?: number | null
          total_collections?: number | null
          total_payouts?: number | null
          updated_at?: string | null
          user_id: string
          welcome_bonus_credited?: boolean | null
          withdrawals_enabled?: boolean | null
        }
        Update: {
          available_balance?: number | null
          balances_by_currency?: Json | null
          created_at?: string | null
          currency?: string | null
          daily_withdrawal_limit?: number | null
          id?: string
          invested_balance?: number | null
          last_24h_withdrawal_total?: number | null
          last_withdrawal_reset_at?: string | null
          payout_mode?: string | null
          pending_balance?: number | null
          total_collections?: number | null
          total_payouts?: number | null
          updated_at?: string | null
          user_id?: string
          welcome_bonus_credited?: boolean | null
          withdrawals_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string | null
          title: string | null
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          title?: string | null
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          title?: string | null
          type?: string | null
          user_id?: string
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
          balance_applied_at: string | null
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
          balance_applied_at?: string | null
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
          balance_applied_at?: string | null
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
      payout_requests: {
        Row: {
          amount: number
          completed_at: string | null
          currency: string | null
          description: string | null
          fee_amount: number | null
          id: string
          network: string | null
          phone_number: string | null
          processed_at: string | null
          provider_reference: string | null
          rejection_reason: string | null
          requested_at: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          amount: number
          completed_at?: string | null
          currency?: string | null
          description?: string | null
          fee_amount?: number | null
          id?: string
          network?: string | null
          phone_number?: string | null
          processed_at?: string | null
          provider_reference?: string | null
          rejection_reason?: string | null
          requested_at?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          completed_at?: string | null
          currency?: string | null
          description?: string | null
          fee_amount?: number | null
          id?: string
          network?: string | null
          phone_number?: string | null
          processed_at?: string | null
          provider_reference?: string | null
          rejection_reason?: string | null
          requested_at?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      platform_settings: {
        Row: {
          auto_approve_threshold: number | null
          created_at: string | null
          currency_fees: Json
          id: string
          kyc_required: boolean | null
          maintenance_mode: boolean | null
          max_payout_amount: number | null
          min_collection_amount: number | null
          min_payout_amount: number | null
          payout_flat_fee: number | null
          payout_processing_time: string | null
          platform_airtel_number: string | null
          platform_fee_percent: number | null
          require_login_verification: boolean | null
          support_email: string | null
          support_phone: string | null
          support_whatsapp: string | null
          supported_currencies: string[] | null
          supported_payment_methods: string[] | null
          updated_at: string | null
          welcome_bonus_amount: number | null
          withdraw_fee_percent: number | null
          withdraw_from_julypay: boolean | null
          withdraw_from_livepay: boolean | null
        }
        Insert: {
          auto_approve_threshold?: number | null
          created_at?: string | null
          currency_fees?: Json
          id?: string
          kyc_required?: boolean | null
          maintenance_mode?: boolean | null
          max_payout_amount?: number | null
          min_collection_amount?: number | null
          min_payout_amount?: number | null
          payout_flat_fee?: number | null
          payout_processing_time?: string | null
          platform_airtel_number?: string | null
          platform_fee_percent?: number | null
          require_login_verification?: boolean | null
          support_email?: string | null
          support_phone?: string | null
          support_whatsapp?: string | null
          supported_currencies?: string[] | null
          supported_payment_methods?: string[] | null
          updated_at?: string | null
          welcome_bonus_amount?: number | null
          withdraw_fee_percent?: number | null
          withdraw_from_julypay?: boolean | null
          withdraw_from_livepay?: boolean | null
        }
        Update: {
          auto_approve_threshold?: number | null
          created_at?: string | null
          currency_fees?: Json
          id?: string
          kyc_required?: boolean | null
          maintenance_mode?: boolean | null
          max_payout_amount?: number | null
          min_collection_amount?: number | null
          min_payout_amount?: number | null
          payout_flat_fee?: number | null
          payout_processing_time?: string | null
          platform_airtel_number?: string | null
          platform_fee_percent?: number | null
          require_login_verification?: boolean | null
          support_email?: string | null
          support_phone?: string | null
          support_whatsapp?: string | null
          supported_currencies?: string[] | null
          supported_payment_methods?: string[] | null
          updated_at?: string | null
          welcome_bonus_amount?: number | null
          withdraw_fee_percent?: number | null
          withdraw_from_julypay?: boolean | null
          withdraw_from_livepay?: boolean | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          default_currency: string | null
          email: string | null
          email_verified: boolean | null
          enabled_currencies: string[] | null
          full_name: string | null
          id: string
          login_verification_enabled: boolean | null
          login_verified_at: string | null
          migrated_from_legacy_at: string | null
          operating_country: string | null
          phone_number: string | null
          role: string | null
          role_tag: string | null
          status: string | null
          support_agent: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          default_currency?: string | null
          email?: string | null
          email_verified?: boolean | null
          enabled_currencies?: string[] | null
          full_name?: string | null
          id: string
          login_verification_enabled?: boolean | null
          login_verified_at?: string | null
          migrated_from_legacy_at?: string | null
          operating_country?: string | null
          phone_number?: string | null
          role?: string | null
          role_tag?: string | null
          status?: string | null
          support_agent?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          default_currency?: string | null
          email?: string | null
          email_verified?: boolean | null
          enabled_currencies?: string[] | null
          full_name?: string | null
          id?: string
          login_verification_enabled?: boolean | null
          login_verified_at?: string | null
          migrated_from_legacy_at?: string | null
          operating_country?: string | null
          phone_number?: string | null
          role?: string | null
          role_tag?: string | null
          status?: string | null
          support_agent?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          created_at: string | null
          id: number
          is_read: boolean | null
          message: string
          receiver_id: string | null
          sender_id: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          is_read?: boolean | null
          message: string
          receiver_id?: string | null
          sender_id: string
        }
        Update: {
          created_at?: string | null
          id?: number
          is_read?: boolean | null
          message?: string
          receiver_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_replies: {
        Row: {
          created_at: string
          id: number
          is_internal: boolean
          message: string
          ticket_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          is_internal?: boolean
          message: string
          ticket_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          is_internal?: boolean
          message?: string
          ticket_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string
          id: number
          priority: string
          resolved_at: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description: string
          id?: number
          priority?: string
          resolved_at?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string
          id?: number
          priority?: string
          resolved_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string | null
          currency: string | null
          customer_name: string | null
          customer_phone: string | null
          description: string | null
          fee_amount: number | null
          id: string
          merchant_reference: string | null
          metadata: Json | null
          net_amount: number | null
          payment_method: string | null
          provider_reference: string | null
          reference: string
          status: string | null
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string | null
          currency?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          fee_amount?: number | null
          id?: string
          merchant_reference?: string | null
          metadata?: Json | null
          net_amount?: number | null
          payment_method?: string | null
          provider_reference?: string | null
          reference: string
          status?: string | null
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string | null
          currency?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          fee_amount?: number | null
          id?: string
          merchant_reference?: string | null
          metadata?: Json | null
          net_amount?: number | null
          payment_method?: string | null
          provider_reference?: string | null
          reference?: string
          status?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      verification_codes: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          email: string
          expires_at: string
          id: string
          type: string
          used: boolean
          user_id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          type: string
          used?: boolean
          user_id: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          type?: string
          used?: boolean
          user_id?: string
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
      claim_registration_code: {
        Args: { p_email: string; p_hash: string; p_user_id: string }
        Returns: string
      }
      confirm_payout_status: {
        Args: {
          p_actor: string
          p_evidence: Json
          p_provider_reference: string
          p_reason: string
          p_record_id: string
          p_status: string
        }
        Returns: Json
      }
      consume_registration_code: {
        Args: { p_hash: string; p_user_id: string }
        Returns: boolean
      }
      exchange_wallet_balance: {
        Args: {
          p_amount: number
          p_fee_percent: number
          p_from: string
          p_merchant_id: string
          p_rate: number
          p_to: string
          p_to_amount: number
        }
        Returns: Json
      }
      find_transfer_recipient: { Args: { p_identifier: string }; Returns: Json }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      reserve_payout_and_balance:
        | {
            Args: {
              p_amount: number
              p_currency: string
              p_description: string
              p_merchant_id: string
              p_metadata?: Json
              p_phone: string
              p_reference: string
              p_source: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_amount: number
              p_currency: string
              p_debit?: number
              p_description: string
              p_merchant_id: string
              p_metadata?: Json
              p_phone: string
              p_reference: string
              p_source: string
            }
            Returns: Json
          }
      set_member_roles: {
        Args: { p_roles: string[]; p_user_id: string }
        Returns: undefined
      }
      settle_payment_record_and_balance: {
        Args: {
          p_fee?: number
          p_provider_reference?: string
          p_record_id: string
          p_status: string
        }
        Returns: Json
      }
      transfer_between_merchants: {
        Args: {
          p_amount: number
          p_currency: string
          p_reason: string
          p_recipient: string
          p_request_id: string
        }
        Returns: Json
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
