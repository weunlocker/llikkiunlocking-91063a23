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
      api_keys: {
        Row: {
          active: boolean
          created_at: string
          id: string
          key: string
          last_used_at: string | null
          name: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          key: string
          last_used_at?: string | null
          name?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          key?: string
          last_used_at?: string | null
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      auth_login_events: {
        Row: {
          created_at: string
          email: string | null
          id: string
          ip: string | null
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          ip?: string | null
          success: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          ip?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_settings: {
        Row: {
          enabled: boolean
          from_email: string | null
          from_name: string
          id: number
          otp_login_enabled: boolean
          reply_to: string | null
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number
          smtp_secure: boolean
          smtp_user: string | null
          tpl_balance_update: Json
          tpl_order_rejected: Json
          tpl_order_success: Json
          tpl_welcome: Json
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          from_email?: string | null
          from_name?: string
          id?: number
          otp_login_enabled?: boolean
          reply_to?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number
          smtp_secure?: boolean
          smtp_user?: string | null
          tpl_balance_update?: Json
          tpl_order_rejected?: Json
          tpl_order_success?: Json
          tpl_welcome?: Json
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          from_email?: string | null
          from_name?: string
          id?: number
          otp_login_enabled?: boolean
          reply_to?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number
          smtp_secure?: boolean
          smtp_user?: string | null
          tpl_balance_update?: Json
          tpl_order_rejected?: Json
          tpl_order_success?: Json
          tpl_welcome?: Json
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          imei: string
          last_polled_at: string | null
          order_number: number
          poll_attempts: number
          price_charged: number
          result: string | null
          service_id: string
          source: string
          status: Database["public"]["Enums"]["order_status"]
          supplier_reference: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          imei: string
          last_polled_at?: string | null
          order_number?: number
          poll_attempts?: number
          price_charged?: number
          result?: string | null
          service_id: string
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          supplier_reference?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          imei?: string
          last_polled_at?: string | null
          order_number?: number
          poll_attempts?: number
          price_charged?: number
          result?: string | null
          service_id?: string
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          supplier_reference?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services_public"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_orders: {
        Row: {
          amount: number
          checkout_url: string | null
          coin: string | null
          created_at: string
          credited: boolean
          currency: string
          expires_at: string | null
          id: string
          matched_at: string | null
          memo: string | null
          merchant_trade_no: string
          prepay_id: string | null
          provider: string
          raw: Json | null
          status: string
          tx_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          checkout_url?: string | null
          coin?: string | null
          created_at?: string
          credited?: boolean
          currency?: string
          expires_at?: string | null
          id?: string
          matched_at?: string | null
          memo?: string | null
          merchant_trade_no: string
          prepay_id?: string | null
          provider?: string
          raw?: Json | null
          status?: string
          tx_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          checkout_url?: string | null
          coin?: string | null
          created_at?: string
          credited?: boolean
          currency?: string
          expires_at?: string | null
          id?: string
          matched_at?: string | null
          memo?: string | null
          merchant_trade_no?: string
          prepay_id?: string | null
          provider?: string
          raw?: Json | null
          status?: string
          tx_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_settings: {
        Row: {
          ask_admin_enabled: boolean
          binance_api_key: string | null
          binance_coins: Json
          binance_enabled: boolean
          binance_last_polled_at: string | null
          binance_min_amount: number
          binance_pay_id: string | null
          binance_poll_enabled: boolean
          binance_qr_url: string | null
          binance_secret_key: string | null
          cashfree_enabled: boolean
          cashfree_env: string
          cashfree_min_amount: number
          cashfree_prod_app_id: string | null
          cashfree_prod_secret_key: string | null
          cashfree_sandbox_app_id: string | null
          cashfree_sandbox_secret_key: string | null
          cashfree_usd_to_inr: number
          id: number
          order_expiry_minutes: number
          topup_amounts: Json
          updated_at: string
        }
        Insert: {
          ask_admin_enabled?: boolean
          binance_api_key?: string | null
          binance_coins?: Json
          binance_enabled?: boolean
          binance_last_polled_at?: string | null
          binance_min_amount?: number
          binance_pay_id?: string | null
          binance_poll_enabled?: boolean
          binance_qr_url?: string | null
          binance_secret_key?: string | null
          cashfree_enabled?: boolean
          cashfree_env?: string
          cashfree_min_amount?: number
          cashfree_prod_app_id?: string | null
          cashfree_prod_secret_key?: string | null
          cashfree_sandbox_app_id?: string | null
          cashfree_sandbox_secret_key?: string | null
          cashfree_usd_to_inr?: number
          id?: number
          order_expiry_minutes?: number
          topup_amounts?: Json
          updated_at?: string
        }
        Update: {
          ask_admin_enabled?: boolean
          binance_api_key?: string | null
          binance_coins?: Json
          binance_enabled?: boolean
          binance_last_polled_at?: string | null
          binance_min_amount?: number
          binance_pay_id?: string | null
          binance_poll_enabled?: boolean
          binance_qr_url?: string | null
          binance_secret_key?: string | null
          cashfree_enabled?: boolean
          cashfree_env?: string
          cashfree_min_amount?: number
          cashfree_prod_app_id?: string | null
          cashfree_prod_secret_key?: string | null
          cashfree_sandbox_app_id?: string | null
          cashfree_sandbox_secret_key?: string | null
          cashfree_usd_to_inr?: number
          id?: number
          order_expiry_minutes?: number
          topup_amounts?: Json
          updated_at?: string
        }
        Relationships: []
      }
      private_settings: {
        Row: {
          id: number
          turnstile_secret_key: string | null
          updated_at: string
        }
        Insert: {
          id?: number
          turnstile_secret_key?: string | null
          updated_at?: string
        }
        Update: {
          id?: number
          turnstile_secret_key?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          api_enabled: boolean
          balance: number
          banned: boolean
          city: string | null
          client_bot_chat_id: string | null
          country: string | null
          created_at: string
          custom_message: string | null
          display_name: string | null
          email: string | null
          id: string
          notify_email: boolean
          notify_telegram: boolean
          phone: string | null
          pincode: string | null
          referral_code: string | null
          referred_at: string | null
          referred_by: string | null
          state: string | null
          telegram_chat_id: string | null
          updated_at: string
          user_group: string
        }
        Insert: {
          address?: string | null
          api_enabled?: boolean
          balance?: number
          banned?: boolean
          city?: string | null
          client_bot_chat_id?: string | null
          country?: string | null
          created_at?: string
          custom_message?: string | null
          display_name?: string | null
          email?: string | null
          id: string
          notify_email?: boolean
          notify_telegram?: boolean
          phone?: string | null
          pincode?: string | null
          referral_code?: string | null
          referred_at?: string | null
          referred_by?: string | null
          state?: string | null
          telegram_chat_id?: string | null
          updated_at?: string
          user_group?: string
        }
        Update: {
          address?: string | null
          api_enabled?: boolean
          balance?: number
          banned?: boolean
          city?: string | null
          client_bot_chat_id?: string | null
          country?: string | null
          created_at?: string
          custom_message?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          notify_email?: boolean
          notify_telegram?: boolean
          phone?: string | null
          pincode?: string | null
          referral_code?: string | null
          referred_at?: string | null
          referred_by?: string | null
          state?: string | null
          telegram_chat_id?: string | null
          updated_at?: string
          user_group?: string
        }
        Relationships: []
      }
      referral_bonuses: {
        Row: {
          bonus_amount: number
          created_at: string
          id: string
          payment_order_id: string | null
          referred_user_id: string
          referrer_id: string
          topup_amount: number
        }
        Insert: {
          bonus_amount: number
          created_at?: string
          id?: string
          payment_order_id?: string | null
          referred_user_id: string
          referrer_id: string
          topup_amount: number
        }
        Update: {
          bonus_amount?: number
          created_at?: string
          id?: string
          payment_order_id?: string | null
          referred_user_id?: string
          referrer_id?: string
          topup_amount?: number
        }
        Relationships: []
      }
      referral_settings: {
        Row: {
          enabled: boolean
          id: number
          min_topup: number
          percent: number
          updated_at: string
          window_days: number
        }
        Insert: {
          enabled?: boolean
          id?: number
          min_topup?: number
          percent?: number
          updated_at?: string
          window_days?: number
        }
        Update: {
          enabled?: boolean
          id?: number
          min_topup?: number
          percent?: number
          updated_at?: string
          window_days?: number
        }
        Relationships: []
      }
      services: {
        Row: {
          active: boolean
          api_headers: Json | null
          api_method: string
          api_request_body: string | null
          api_url: string | null
          category: string | null
          created_at: string
          delivery_time: string
          description: string | null
          id: string
          is_free: boolean
          name: string
          price: number
          response_template: string | null
          result_color: string | null
          result_font: string | null
          sample_result: string | null
          service_code: string | null
          sort_order: number
          success_rules: Json | null
          supplier_action: string | null
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          api_headers?: Json | null
          api_method?: string
          api_request_body?: string | null
          api_url?: string | null
          category?: string | null
          created_at?: string
          delivery_time?: string
          description?: string | null
          id?: string
          is_free?: boolean
          name: string
          price?: number
          response_template?: string | null
          result_color?: string | null
          result_font?: string | null
          sample_result?: string | null
          service_code?: string | null
          sort_order?: number
          success_rules?: Json | null
          supplier_action?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          api_headers?: Json | null
          api_method?: string
          api_request_body?: string | null
          api_url?: string | null
          category?: string | null
          created_at?: string
          delivery_time?: string
          description?: string | null
          id?: string
          is_free?: boolean
          name?: string
          price?: number
          response_template?: string | null
          result_color?: string | null
          result_font?: string | null
          sample_result?: string | null
          service_code?: string | null
          sort_order?: number
          success_rules?: Json | null
          supplier_action?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          address: string | null
          admin_bot_token: string | null
          admin_bot_username: string | null
          admin_chat_ids: string[]
          brand_name: string
          client_bot_token: string | null
          client_bot_username: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          facebook_url: string | null
          favicon_url: string | null
          footer_text: string | null
          id: number
          instagram_url: string | null
          logo_url: string | null
          seo_description: string | null
          seo_keywords: string | null
          seo_title: string | null
          tagline: string | null
          telegram_channel_id: string | null
          telegram_group_id: string | null
          telegram_url: string | null
          turnstile_enabled: boolean
          turnstile_site_key: string | null
          twitter_url: string | null
          updated_at: string
          whatsapp_number: string | null
          youtube_url: string | null
        }
        Insert: {
          address?: string | null
          admin_bot_token?: string | null
          admin_bot_username?: string | null
          admin_chat_ids?: string[]
          brand_name?: string
          client_bot_token?: string | null
          client_bot_username?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          facebook_url?: string | null
          favicon_url?: string | null
          footer_text?: string | null
          id?: number
          instagram_url?: string | null
          logo_url?: string | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          tagline?: string | null
          telegram_channel_id?: string | null
          telegram_group_id?: string | null
          telegram_url?: string | null
          turnstile_enabled?: boolean
          turnstile_site_key?: string | null
          twitter_url?: string | null
          updated_at?: string
          whatsapp_number?: string | null
          youtube_url?: string | null
        }
        Update: {
          address?: string | null
          admin_bot_token?: string | null
          admin_bot_username?: string | null
          admin_chat_ids?: string[]
          brand_name?: string
          client_bot_token?: string | null
          client_bot_username?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          facebook_url?: string | null
          favicon_url?: string | null
          footer_text?: string | null
          id?: number
          instagram_url?: string | null
          logo_url?: string | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          tagline?: string | null
          telegram_channel_id?: string | null
          telegram_group_id?: string | null
          telegram_url?: string | null
          turnstile_enabled?: boolean
          turnstile_site_key?: string | null
          twitter_url?: string | null
          updated_at?: string
          whatsapp_number?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      supplier_services: {
        Row: {
          action_code: string
          credit: number | null
          delivery_time: string | null
          id: string
          info: string | null
          name: string
          raw: Json | null
          supplier_id: string
          synced_at: string
        }
        Insert: {
          action_code: string
          credit?: number | null
          delivery_time?: string | null
          id?: string
          info?: string | null
          name: string
          raw?: Json | null
          supplier_id: string
          synced_at?: string
        }
        Update: {
          action_code?: string
          credit?: number | null
          delivery_time?: string | null
          id?: string
          info?: string | null
          name?: string
          raw?: Json | null
          supplier_id?: string
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_services_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          api_format: string
          created_at: string
          dhru_api_key: string | null
          dhru_username: string | null
          endpoint_url: string
          id: string
          name: string
          notes: string | null
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          api_format?: string
          created_at?: string
          dhru_api_key?: string | null
          dhru_username?: string | null
          endpoint_url: string
          id?: string
          name: string
          notes?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          api_format?: string
          created_at?: string
          dhru_api_key?: string | null
          dhru_username?: string | null
          endpoint_url?: string
          id?: string
          name?: string
          notes?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_ticket_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          sender_id: string
          sender_type: Database["public"]["Enums"]["support_sender_type"]
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          sender_id: string
          sender_type: Database["public"]["Enums"]["support_sender_type"]
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          sender_id?: string
          sender_type?: Database["public"]["Enums"]["support_sender_type"]
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          priority: Database["public"]["Enums"]["support_ticket_priority"]
          status: Database["public"]["Enums"]["support_ticket_status"]
          subject: string
          unread_for_admin: boolean
          unread_for_user: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          priority?: Database["public"]["Enums"]["support_ticket_priority"]
          status?: Database["public"]["Enums"]["support_ticket_status"]
          subject: string
          unread_for_admin?: boolean
          unread_for_user?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          priority?: Database["public"]["Enums"]["support_ticket_priority"]
          status?: Database["public"]["Enums"]["support_ticket_status"]
          subject?: string
          unread_for_admin?: boolean
          unread_for_user?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      telegram_chat_state: {
        Row: {
          bot_kind: string
          chat_id: string
          state: Json
          updated_at: string
        }
        Insert: {
          bot_kind: string
          chat_id: string
          state: Json
          updated_at?: string
        }
        Update: {
          bot_kind?: string
          chat_id?: string
          state?: Json
          updated_at?: string
        }
        Relationships: []
      }
      telegram_pairings: {
        Row: {
          bot_kind: string
          chat_id: string | null
          code: string
          created_at: string
          expires_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          bot_kind: string
          chat_id?: string | null
          code: string
          created_at?: string
          expires_at: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          bot_kind?: string
          chat_id?: string | null
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      telegram_updates: {
        Row: {
          bot_kind: string
          created_at: string
          update_id: number
        }
        Insert: {
          bot_kind: string
          created_at?: string
          update_id: number
        }
        Update: {
          bot_kind?: string
          created_at?: string
          update_id?: number
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          description: string | null
          id: string
          order_id: string | null
          type: Database["public"]["Enums"]["tx_type"]
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          type: Database["public"]["Enums"]["tx_type"]
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          type?: Database["public"]["Enums"]["tx_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
      user_service_overrides: {
        Row: {
          created_at: string
          custom_price: number | null
          enabled: boolean
          id: string
          service_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_price?: number | null
          enabled?: boolean
          id?: string
          service_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_price?: number | null
          enabled?: boolean
          id?: string
          service_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      services_public: {
        Row: {
          active: boolean | null
          category: string | null
          created_at: string | null
          delivery_time: string | null
          description: string | null
          id: string | null
          is_async: boolean | null
          is_free: boolean | null
          name: string | null
          price: number | null
          result_color: string | null
          result_font: string | null
          sample_result: string | null
          service_code: string | null
          sort_order: number | null
          updated_at: string | null
        }
        Relationships: []
      }
      site_settings_public: {
        Row: {
          address: string | null
          brand_name: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          facebook_url: string | null
          favicon_url: string | null
          footer_text: string | null
          id: number | null
          instagram_url: string | null
          logo_url: string | null
          seo_description: string | null
          seo_keywords: string | null
          seo_title: string | null
          tagline: string | null
          telegram_url: string | null
          turnstile_enabled: boolean | null
          turnstile_site_key: string | null
          twitter_url: string | null
          updated_at: string | null
          whatsapp_number: string | null
          youtube_url: string | null
        }
        Insert: {
          address?: string | null
          brand_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          facebook_url?: string | null
          favicon_url?: string | null
          footer_text?: string | null
          id?: number | null
          instagram_url?: string | null
          logo_url?: string | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          tagline?: string | null
          telegram_url?: string | null
          turnstile_enabled?: boolean | null
          turnstile_site_key?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          whatsapp_number?: string | null
          youtube_url?: string | null
        }
        Update: {
          address?: string | null
          brand_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          facebook_url?: string | null
          favicon_url?: string | null
          footer_text?: string | null
          id?: number | null
          instagram_url?: string | null
          logo_url?: string | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          tagline?: string | null
          telegram_url?: string | null
          turnstile_enabled?: boolean | null
          turnstile_site_key?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          whatsapp_number?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      award_referral_bonus: {
        Args: {
          p_payment_order_id?: string
          p_referred_user_id: string
          p_topup_amount: number
        }
        Returns: Json
      }
      credit_balance: {
        Args: { p_amount: number; p_user_id: string }
        Returns: number
      }
      deduct_balance: {
        Args: { p_amount: number; p_user_id: string }
        Returns: number
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      gen_referral_code: { Args: never; Returns: string }
      get_otp_login_enabled: { Args: never; Returns: boolean }
      get_public_payment_settings: {
        Args: never
        Returns: {
          ask_admin_enabled: boolean
          binance_coins: Json
          binance_enabled: boolean
          binance_min_amount: number
          binance_pay_id: string
          binance_qr_url: string
          cashfree_enabled: boolean
          cashfree_min_amount: number
          cashfree_usd_to_inr: number
          order_expiry_minutes: number
          topup_amounts: Json
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
      order_status:
        | "pending"
        | "completed"
        | "failed"
        | "refunded"
        | "in_process"
      support_sender_type: "user" | "admin"
      support_ticket_priority: "low" | "normal" | "high" | "urgent"
      support_ticket_status: "open" | "pending" | "closed"
      tx_type: "topup" | "charge" | "refund" | "admin_credit" | "admin_debit"
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
      app_role: ["admin", "user"],
      order_status: [
        "pending",
        "completed",
        "failed",
        "refunded",
        "in_process",
      ],
      support_sender_type: ["user", "admin"],
      support_ticket_priority: ["low", "normal", "high", "urgent"],
      support_ticket_status: ["open", "pending", "closed"],
      tx_type: ["topup", "charge", "refund", "admin_credit", "admin_debit"],
    },
  },
} as const
