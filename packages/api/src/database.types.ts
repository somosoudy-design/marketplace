export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      account_deletion_requests: {
        Row: {
          id: string;
          notes: string | null;
          processed_at: string | null;
          processed_by: string | null;
          reason: string | null;
          requested_at: string;
          status: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          notes?: string | null;
          processed_at?: string | null;
          processed_by?: string | null;
          reason?: string | null;
          requested_at?: string;
          status?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          notes?: string | null;
          processed_at?: string | null;
          processed_by?: string | null;
          reason?: string | null;
          requested_at?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      addresses: {
        Row: {
          city: string;
          country_code: string;
          created_at: string;
          id: string;
          id_document: string | null;
          is_default: boolean;
          label: string;
          line1: string;
          municipality: string | null;
          phone: string;
          recipient: string;
          reference: string | null;
          region_code: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          city: string;
          country_code?: string;
          created_at?: string;
          id?: string;
          id_document?: string | null;
          is_default?: boolean;
          label?: string;
          line1: string;
          municipality?: string | null;
          phone: string;
          recipient: string;
          reference?: string | null;
          region_code: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          city?: string;
          country_code?: string;
          created_at?: string;
          id?: string;
          id_document?: string | null;
          is_default?: boolean;
          label?: string;
          line1?: string;
          municipality?: string | null;
          phone?: string;
          recipient?: string;
          reference?: string | null;
          region_code?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'addresses_country_code_region_code_fkey';
            columns: ['country_code', 'region_code'];
            isOneToOne: false;
            referencedRelation: 'regions';
            referencedColumns: ['country_code', 'code'];
          },
        ];
      };
      app_settings: {
        Row: {
          description: string | null;
          is_public: boolean;
          key: string;
          updated_at: string;
          updated_by: string | null;
          value: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          description?: string | null;
          is_public?: boolean;
          key: string;
          updated_at?: string;
          updated_by?: string | null;
          value: NonNullable<Json>;
        };
        Update: {
          description?: string | null;
          is_public?: boolean;
          key?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: NonNullable<Json>;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_role: string | null;
          created_at: string;
          data: Json | null;
          entity: string;
          entity_id: string | null;
          id: number;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_role?: string | null;
          created_at?: string;
          data?: Json | null;
          entity: string;
          entity_id?: string | null;
          id?: never;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_role?: string | null;
          created_at?: string;
          data?: Json | null;
          entity?: string;
          entity_id?: string | null;
          id?: never;
        };
        Relationships: [];
      };
      brands: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          official_url: string | null;
          slug: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          official_url?: string | null;
          slug: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          official_url?: string | null;
          slug?: string;
        };
        Relationships: [];
      };
      buyer_refund_payouts: {
        Row: {
          amount_usd: number;
          id: string;
          method: string;
          order_id: string;
          paid_at: string;
          paid_by: string | null;
          reference: string;
        };
        ComputedFields: never;
        Insert: {
          amount_usd: number;
          id?: string;
          method: string;
          order_id: string;
          paid_at?: string;
          paid_by?: string | null;
          reference: string;
        };
        Update: {
          amount_usd?: number;
          id?: string;
          method?: string;
          order_id?: string;
          paid_at?: string;
          paid_by?: string | null;
          reference?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'buyer_refund_payouts_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      cargo_batches: {
        Row: {
          arrived_at: string | null;
          carrier: string | null;
          code: string;
          created_at: string;
          created_by: string | null;
          departed_at: string | null;
          description: string | null;
          id: string;
          step_code: string;
          tracking_number: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          arrived_at?: string | null;
          carrier?: string | null;
          code: string;
          created_at?: string;
          created_by?: string | null;
          departed_at?: string | null;
          description?: string | null;
          id?: string;
          step_code?: string;
          tracking_number?: string | null;
          updated_at?: string;
        };
        Update: {
          arrived_at?: string | null;
          carrier?: string | null;
          code?: string;
          created_at?: string;
          created_by?: string | null;
          departed_at?: string | null;
          description?: string | null;
          id?: string;
          step_code?: string;
          tracking_number?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      carriers: {
        Row: {
          active: boolean;
          code: string;
          id: string;
          is_demo: boolean;
          name: string;
          tracking_url_template: string | null;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          code: string;
          id?: string;
          is_demo?: boolean;
          name: string;
          tracking_url_template?: string | null;
        };
        Update: {
          active?: boolean;
          code?: string;
          id?: string;
          is_demo?: boolean;
          name?: string;
          tracking_url_template?: string | null;
        };
        Relationships: [];
      };
      cart_items: {
        Row: {
          added_at: string;
          quantity: number;
          updated_at: string;
          user_id: string;
          variant_id: string;
        };
        ComputedFields: never;
        Insert: {
          added_at?: string;
          quantity: number;
          updated_at?: string;
          user_id: string;
          variant_id: string;
        };
        Update: {
          added_at?: string;
          quantity?: number;
          updated_at?: string;
          user_id?: string;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cart_items_variant_id_fkey';
            columns: ['variant_id'];
            isOneToOne: false;
            referencedRelation: 'product_variants';
            referencedColumns: ['id'];
          },
        ];
      };
      categories: {
        Row: {
          active: boolean;
          created_at: string;
          icon: string | null;
          id: string;
          name: string;
          parent_id: string | null;
          requires_review: boolean;
          risk_level: Database['public']['Enums']['risk_level'];
          slug: string;
          sort: number;
          tone: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          created_at?: string;
          icon?: string | null;
          id?: string;
          name: string;
          parent_id?: string | null;
          requires_review?: boolean;
          risk_level?: Database['public']['Enums']['risk_level'];
          slug: string;
          sort?: number;
          tone?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          icon?: string | null;
          id?: string;
          name?: string;
          parent_id?: string | null;
          requires_review?: boolean;
          risk_level?: Database['public']['Enums']['risk_level'];
          slug?: string;
          sort?: number;
          tone?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'categories_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
        ];
      };
      cities: {
        Row: {
          country_code: string;
          id: number;
          is_capital: boolean;
          name: string;
          region_code: string;
        };
        ComputedFields: never;
        Insert: {
          country_code?: string;
          id?: number;
          is_capital?: boolean;
          name: string;
          region_code: string;
        };
        Update: {
          country_code?: string;
          id?: number;
          is_capital?: boolean;
          name?: string;
          region_code?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cities_country_code_region_code_fkey';
            columns: ['country_code', 'region_code'];
            isOneToOne: false;
            referencedRelation: 'regions';
            referencedColumns: ['country_code', 'code'];
          },
        ];
      };
      claim_messages: {
        Row: {
          author_id: string;
          author_role: string;
          body: string;
          claim_id: string;
          created_at: string;
          id: number;
        };
        ComputedFields: never;
        Insert: {
          author_id: string;
          author_role: string;
          body: string;
          claim_id: string;
          created_at?: string;
          id?: never;
        };
        Update: {
          author_id?: string;
          author_role?: string;
          body?: string;
          claim_id?: string;
          created_at?: string;
          id?: never;
        };
        Relationships: [
          {
            foreignKeyName: 'claim_messages_claim_id_fkey';
            columns: ['claim_id'];
            isOneToOne: false;
            referencedRelation: 'claims';
            referencedColumns: ['id'];
          },
        ];
      };
      claims: {
        Row: {
          buyer_id: string;
          created_at: string;
          description: string;
          fulfillment_id: string;
          id: string;
          number: string;
          order_id: string;
          reason: string;
          resolution: string | null;
          status: Database['public']['Enums']['claim_status'];
          store_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          buyer_id: string;
          created_at?: string;
          description: string;
          fulfillment_id: string;
          id?: string;
          number: string;
          order_id: string;
          reason: string;
          resolution?: string | null;
          status?: Database['public']['Enums']['claim_status'];
          store_id: string;
          updated_at?: string;
        };
        Update: {
          buyer_id?: string;
          created_at?: string;
          description?: string;
          fulfillment_id?: string;
          id?: string;
          number?: string;
          order_id?: string;
          reason?: string;
          resolution?: string | null;
          status?: Database['public']['Enums']['claim_status'];
          store_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'claims_fulfillment_id_fkey';
            columns: ['fulfillment_id'];
            isOneToOne: false;
            referencedRelation: 'fulfillments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'claims_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'claims_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
      collection_products: {
        Row: {
          collection_id: string;
          product_id: string;
          sort: number;
        };
        ComputedFields: never;
        Insert: {
          collection_id: string;
          product_id: string;
          sort?: number;
        };
        Update: {
          collection_id?: string;
          product_id?: string;
          sort?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'collection_products_collection_id_fkey';
            columns: ['collection_id'];
            isOneToOne: false;
            referencedRelation: 'collections';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'collection_products_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'product_cards';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'collection_products_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      collections: {
        Row: {
          active: boolean;
          cover_path: string | null;
          created_at: string;
          ends_at: string | null;
          id: string;
          layout: string;
          slug: string;
          sort: number;
          starts_at: string | null;
          subtitle: string | null;
          title: string;
          tone: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          cover_path?: string | null;
          created_at?: string;
          ends_at?: string | null;
          id?: string;
          layout?: string;
          slug: string;
          sort?: number;
          starts_at?: string | null;
          subtitle?: string | null;
          title: string;
          tone?: string;
        };
        Update: {
          active?: boolean;
          cover_path?: string | null;
          created_at?: string;
          ends_at?: string | null;
          id?: string;
          layout?: string;
          slug?: string;
          sort?: number;
          starts_at?: string | null;
          subtitle?: string | null;
          title?: string;
          tone?: string;
        };
        Relationships: [];
      };
      commission_rules: {
        Row: {
          active: boolean;
          category_id: string | null;
          id: string;
          note: string | null;
          rate_pct: number;
          store_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          category_id?: string | null;
          id?: string;
          note?: string | null;
          rate_pct: number;
          store_id?: string | null;
        };
        Update: {
          active?: boolean;
          category_id?: string | null;
          id?: string;
          note?: string | null;
          rate_pct?: number;
          store_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'commission_rules_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commission_rules_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
      exchange_rate_sources: {
        Row: {
          adapter: string;
          code: string;
          docs_url: string | null;
          enabled: boolean;
          kind: Database['public']['Enums']['rate_source_kind'];
          name: string;
          notes: string | null;
          pair: string;
        };
        ComputedFields: never;
        Insert: {
          adapter: string;
          code: string;
          docs_url?: string | null;
          enabled?: boolean;
          kind: Database['public']['Enums']['rate_source_kind'];
          name: string;
          notes?: string | null;
          pair: string;
        };
        Update: {
          adapter?: string;
          code?: string;
          docs_url?: string | null;
          enabled?: boolean;
          kind?: Database['public']['Enums']['rate_source_kind'];
          name?: string;
          notes?: string | null;
          pair?: string;
        };
        Relationships: [];
      };
      exchange_rates: {
        Row: {
          created_by: string | null;
          fetched_at: string;
          id: number;
          observed_at: string;
          pair: string;
          rate: number;
          raw: Json | null;
          source_code: string;
        };
        ComputedFields: never;
        Insert: {
          created_by?: string | null;
          fetched_at?: string;
          id?: never;
          observed_at: string;
          pair: string;
          rate: number;
          raw?: Json | null;
          source_code: string;
        };
        Update: {
          created_by?: string | null;
          fetched_at?: string;
          id?: never;
          observed_at?: string;
          pair?: string;
          rate?: number;
          raw?: Json | null;
          source_code?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'exchange_rates_source_code_fkey';
            columns: ['source_code'];
            isOneToOne: false;
            referencedRelation: 'exchange_rate_sources';
            referencedColumns: ['code'];
          },
        ];
      };
      favorites: {
        Row: {
          created_at: string;
          product_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          product_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          product_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'favorites_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'product_cards';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'favorites_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      fulfillment_events: {
        Row: {
          actor_id: string | null;
          created_at: string;
          fulfillment_id: string;
          id: number;
          note: string | null;
          source: string;
          step_code: string;
          visible_to_buyer: boolean;
        };
        ComputedFields: never;
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          fulfillment_id: string;
          id?: never;
          note?: string | null;
          source: string;
          step_code: string;
          visible_to_buyer?: boolean;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          fulfillment_id?: string;
          id?: never;
          note?: string | null;
          source?: string;
          step_code?: string;
          visible_to_buyer?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'fulfillment_events_fulfillment_id_fkey';
            columns: ['fulfillment_id'];
            isOneToOne: false;
            referencedRelation: 'fulfillments';
            referencedColumns: ['id'];
          },
        ];
      };
      fulfillment_steps: {
        Row: {
          buyer_description: string | null;
          buyer_label: string;
          code: string;
          flow: Database['public']['Enums']['fulfillment_flow'];
          is_terminal: boolean;
          label: string;
          notify_buyer: boolean;
          requires_payment: string | null;
          seller_can_set: boolean;
          seq: number;
        };
        ComputedFields: never;
        Insert: {
          buyer_description?: string | null;
          buyer_label: string;
          code: string;
          flow: Database['public']['Enums']['fulfillment_flow'];
          is_terminal?: boolean;
          label: string;
          notify_buyer?: boolean;
          requires_payment?: string | null;
          seller_can_set?: boolean;
          seq: number;
        };
        Update: {
          buyer_description?: string | null;
          buyer_label?: string;
          code?: string;
          flow?: Database['public']['Enums']['fulfillment_flow'];
          is_terminal?: boolean;
          label?: string;
          notify_buyer?: boolean;
          requires_payment?: string | null;
          seller_can_set?: boolean;
          seq?: number;
        };
        Relationships: [];
      };
      fulfillments: {
        Row: {
          cargo_batch_id: string | null;
          carrier_name: string | null;
          created_at: string;
          delivered_at: string | null;
          eta_max_date: string | null;
          eta_min_date: string | null;
          flow: Database['public']['Enums']['fulfillment_flow'];
          group_key: string;
          id: string;
          order_id: string;
          ready_max_days: number;
          ready_min_days: number;
          seq: number;
          settled: boolean;
          ship_to: NonNullable<Json>;
          shipping_kind: Database['public']['Enums']['shipping_kind'] | null;
          shipping_method_id: string | null;
          shipping_method_name: string | null;
          shipping_usd: number;
          status: string;
          store_id: string;
          tracking_number: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          cargo_batch_id?: string | null;
          carrier_name?: string | null;
          created_at?: string;
          delivered_at?: string | null;
          eta_max_date?: string | null;
          eta_min_date?: string | null;
          flow: Database['public']['Enums']['fulfillment_flow'];
          group_key: string;
          id?: string;
          order_id: string;
          ready_max_days?: number;
          ready_min_days?: number;
          seq: number;
          settled?: boolean;
          ship_to: NonNullable<Json>;
          shipping_kind?: Database['public']['Enums']['shipping_kind'] | null;
          shipping_method_id?: string | null;
          shipping_method_name?: string | null;
          shipping_usd?: number;
          status: string;
          store_id: string;
          tracking_number?: string | null;
          updated_at?: string;
        };
        Update: {
          cargo_batch_id?: string | null;
          carrier_name?: string | null;
          created_at?: string;
          delivered_at?: string | null;
          eta_max_date?: string | null;
          eta_min_date?: string | null;
          flow?: Database['public']['Enums']['fulfillment_flow'];
          group_key?: string;
          id?: string;
          order_id?: string;
          ready_max_days?: number;
          ready_min_days?: number;
          seq?: number;
          settled?: boolean;
          ship_to?: NonNullable<Json>;
          shipping_kind?: Database['public']['Enums']['shipping_kind'] | null;
          shipping_method_id?: string | null;
          shipping_method_name?: string | null;
          shipping_usd?: number;
          status?: string;
          store_id?: string;
          tracking_number?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fulfillments_cargo_batch_id_fkey';
            columns: ['cargo_batch_id'];
            isOneToOne: false;
            referencedRelation: 'cargo_batches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fulfillments_flow_status_fkey';
            columns: ['flow', 'status'];
            isOneToOne: false;
            referencedRelation: 'fulfillment_steps';
            referencedColumns: ['flow', 'code'];
          },
          {
            foreignKeyName: 'fulfillments_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fulfillments_shipping_method_id_fkey';
            columns: ['shipping_method_id'];
            isOneToOne: false;
            referencedRelation: 'shipping_methods';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fulfillments_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
      installment_plans: {
        Row: {
          active: boolean;
          allowed_flows: Database['public']['Enums']['fulfillment_flow'][];
          code: string;
          description: string | null;
          down_payment_pct: number;
          installments: number;
          interval_days: number;
          min_order_usd: number;
          name: string;
          sort: number;
          surcharge_pct: number;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          allowed_flows?: Database['public']['Enums']['fulfillment_flow'][];
          code: string;
          description?: string | null;
          down_payment_pct: number;
          installments?: number;
          interval_days?: number;
          min_order_usd?: number;
          name: string;
          sort?: number;
          surcharge_pct?: number;
        };
        Update: {
          active?: boolean;
          allowed_flows?: Database['public']['Enums']['fulfillment_flow'][];
          code?: string;
          description?: string | null;
          down_payment_pct?: number;
          installments?: number;
          interval_days?: number;
          min_order_usd?: number;
          name?: string;
          sort?: number;
          surcharge_pct?: number;
        };
        Relationships: [];
      };
      lead_time_rules: {
        Row: {
          active: boolean;
          availability: Database['public']['Enums']['availability'];
          category_id: string | null;
          id: string;
          label: string | null;
          max_days: number;
          min_days: number;
          origin: Database['public']['Enums']['product_origin'] | null;
          store_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          availability: Database['public']['Enums']['availability'];
          category_id?: string | null;
          id?: string;
          label?: string | null;
          max_days: number;
          min_days: number;
          origin?: Database['public']['Enums']['product_origin'] | null;
          store_id?: string | null;
        };
        Update: {
          active?: boolean;
          availability?: Database['public']['Enums']['availability'];
          category_id?: string | null;
          id?: string;
          label?: string | null;
          max_days?: number;
          min_days?: number;
          origin?: Database['public']['Enums']['product_origin'] | null;
          store_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'lead_time_rules_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lead_time_rules_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
      ledger_entries: {
        Row: {
          account: Database['public']['Enums']['ledger_account'];
          amount_usd: number;
          created_at: string;
          created_by: string | null;
          entry_group: string;
          event: string;
          fulfillment_id: string | null;
          id: number;
          memo: string | null;
          order_id: string | null;
          payment_id: string | null;
          payout_id: string | null;
          store_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          account: Database['public']['Enums']['ledger_account'];
          amount_usd: number;
          created_at?: string;
          created_by?: string | null;
          entry_group: string;
          event: string;
          fulfillment_id?: string | null;
          id?: never;
          memo?: string | null;
          order_id?: string | null;
          payment_id?: string | null;
          payout_id?: string | null;
          store_id?: string | null;
        };
        Update: {
          account?: Database['public']['Enums']['ledger_account'];
          amount_usd?: number;
          created_at?: string;
          created_by?: string | null;
          entry_group?: string;
          event?: string;
          fulfillment_id?: string | null;
          id?: never;
          memo?: string | null;
          order_id?: string | null;
          payment_id?: string | null;
          payout_id?: string | null;
          store_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'ledger_entries_fulfillment_id_fkey';
            columns: ['fulfillment_id'];
            isOneToOne: false;
            referencedRelation: 'fulfillments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ledger_entries_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ledger_entries_payment_id_fkey';
            columns: ['payment_id'];
            isOneToOne: false;
            referencedRelation: 'payments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ledger_entries_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
      moderation_events: {
        Row: {
          actor_id: string | null;
          automatic: boolean;
          created_at: string;
          from_status: Database['public']['Enums']['moderation_status'] | null;
          id: number;
          note: string | null;
          product_id: string;
          to_status: Database['public']['Enums']['moderation_status'];
        };
        ComputedFields: never;
        Insert: {
          actor_id?: string | null;
          automatic?: boolean;
          created_at?: string;
          from_status?: Database['public']['Enums']['moderation_status'] | null;
          id?: never;
          note?: string | null;
          product_id: string;
          to_status: Database['public']['Enums']['moderation_status'];
        };
        Update: {
          actor_id?: string | null;
          automatic?: boolean;
          created_at?: string;
          from_status?: Database['public']['Enums']['moderation_status'] | null;
          id?: never;
          note?: string | null;
          product_id?: string;
          to_status?: Database['public']['Enums']['moderation_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'moderation_events_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'product_cards';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'moderation_events_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          body: string;
          created_at: string;
          data: NonNullable<Json>;
          id: string;
          is_test: boolean;
          kind: string;
          push_attempts: number;
          push_claimed_at: string | null;
          push_error: string | null;
          push_status: string;
          read_at: string | null;
          title: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          created_at?: string;
          data?: NonNullable<Json>;
          id?: string;
          is_test?: boolean;
          kind: string;
          push_attempts?: number;
          push_claimed_at?: string | null;
          push_error?: string | null;
          push_status?: string;
          read_at?: string | null;
          title: string;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          data?: NonNullable<Json>;
          id?: string;
          is_test?: boolean;
          kind?: string;
          push_attempts?: number;
          push_claimed_at?: string | null;
          push_error?: string | null;
          push_status?: string;
          read_at?: string | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          availability: Database['public']['Enums']['availability'];
          commission_pct: number;
          commission_usd: number;
          fulfillment_id: string;
          id: string;
          image_path: string | null;
          line_total_usd: number;
          order_id: string;
          product_id: string;
          quantity: number;
          refunded_qty: number;
          refunded_usd: number;
          store_id: string;
          title: string;
          unit_price_usd: number;
          variant_id: string;
          variant_title: string | null;
        };
        ComputedFields: never;
        Insert: {
          availability: Database['public']['Enums']['availability'];
          commission_pct?: number;
          commission_usd?: number;
          fulfillment_id: string;
          id?: string;
          image_path?: string | null;
          line_total_usd: number;
          order_id: string;
          product_id: string;
          quantity: number;
          refunded_qty?: number;
          refunded_usd?: number;
          store_id: string;
          title: string;
          unit_price_usd: number;
          variant_id: string;
          variant_title?: string | null;
        };
        Update: {
          availability?: Database['public']['Enums']['availability'];
          commission_pct?: number;
          commission_usd?: number;
          fulfillment_id?: string;
          id?: string;
          image_path?: string | null;
          line_total_usd?: number;
          order_id?: string;
          product_id?: string;
          quantity?: number;
          refunded_qty?: number;
          refunded_usd?: number;
          store_id?: string;
          title?: string;
          unit_price_usd?: number;
          variant_id?: string;
          variant_title?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'order_items_fulfillment_id_fkey';
            columns: ['fulfillment_id'];
            isOneToOne: false;
            referencedRelation: 'fulfillments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'product_cards';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_variant_id_fkey';
            columns: ['variant_id'];
            isOneToOne: false;
            referencedRelation: 'product_variants';
            referencedColumns: ['id'];
          },
        ];
      };
      orders: {
        Row: {
          buyer_id: string;
          cancel_reason: string | null;
          currency: string;
          discount_usd: number;
          financing_usd: number;
          id: string;
          idempotency_key: string;
          is_demo: boolean;
          items_usd: number;
          notes: string | null;
          number: string;
          paid_usd: number;
          payment_status: Database['public']['Enums']['order_payment_status'];
          placed_at: string;
          plan_code: string;
          refunded_usd: number;
          ship_to: NonNullable<Json>;
          shipping_usd: number;
          status: Database['public']['Enums']['order_status'];
          total_usd: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          buyer_id: string;
          cancel_reason?: string | null;
          currency?: string;
          discount_usd?: number;
          financing_usd?: number;
          id?: string;
          idempotency_key: string;
          is_demo?: boolean;
          items_usd: number;
          notes?: string | null;
          number: string;
          paid_usd?: number;
          payment_status?: Database['public']['Enums']['order_payment_status'];
          placed_at?: string;
          plan_code: string;
          refunded_usd?: number;
          ship_to: NonNullable<Json>;
          shipping_usd?: number;
          status?: Database['public']['Enums']['order_status'];
          total_usd: number;
          updated_at?: string;
        };
        Update: {
          buyer_id?: string;
          cancel_reason?: string | null;
          currency?: string;
          discount_usd?: number;
          financing_usd?: number;
          id?: string;
          idempotency_key?: string;
          is_demo?: boolean;
          items_usd?: number;
          notes?: string | null;
          number?: string;
          paid_usd?: number;
          payment_status?: Database['public']['Enums']['order_payment_status'];
          placed_at?: string;
          plan_code?: string;
          refunded_usd?: number;
          ship_to?: NonNullable<Json>;
          shipping_usd?: number;
          status?: Database['public']['Enums']['order_status'];
          total_usd?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      payment_allocations: {
        Row: {
          amount_usd: number;
          created_at: string;
          id: number;
          obligation_id: string;
          payment_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount_usd: number;
          created_at?: string;
          id?: never;
          obligation_id: string;
          payment_id: string;
        };
        Update: {
          amount_usd?: number;
          created_at?: string;
          id?: never;
          obligation_id?: string;
          payment_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payment_allocations_obligation_id_fkey';
            columns: ['obligation_id'];
            isOneToOne: false;
            referencedRelation: 'payment_obligations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payment_allocations_payment_id_fkey';
            columns: ['payment_id'];
            isOneToOne: false;
            referencedRelation: 'payments';
            referencedColumns: ['id'];
          },
        ];
      };
      payment_events: {
        Row: {
          error: string | null;
          event_type: string;
          id: number;
          payload: NonNullable<Json>;
          payment_id: string | null;
          processed: boolean;
          provider: string;
          provider_event_id: string;
          received_at: string;
          signature_valid: boolean;
        };
        ComputedFields: never;
        Insert: {
          error?: string | null;
          event_type: string;
          id?: never;
          payload: NonNullable<Json>;
          payment_id?: string | null;
          processed?: boolean;
          provider: string;
          provider_event_id: string;
          received_at?: string;
          signature_valid: boolean;
        };
        Update: {
          error?: string | null;
          event_type?: string;
          id?: never;
          payload?: NonNullable<Json>;
          payment_id?: string | null;
          processed?: boolean;
          provider?: string;
          provider_event_id?: string;
          received_at?: string;
          signature_valid?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'payment_events_payment_id_fkey';
            columns: ['payment_id'];
            isOneToOne: false;
            referencedRelation: 'payments';
            referencedColumns: ['id'];
          },
        ];
      };
      payment_methods: {
        Row: {
          code: string;
          currency: string;
          description: string | null;
          enabled: boolean;
          fee_fixed_usd: number;
          fee_pct: number;
          instructions: NonNullable<Json>;
          integration_status: Database['public']['Enums']['integration_status'];
          kind: Database['public']['Enums']['payment_kind'];
          max_usd: number | null;
          min_usd: number;
          name: string;
          quote_ttl_minutes: number;
          rail: string;
          reference_pattern: string | null;
          requires_proof: boolean;
          requires_reference: boolean;
          sort: number;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          currency: string;
          description?: string | null;
          enabled?: boolean;
          fee_fixed_usd?: number;
          fee_pct?: number;
          instructions?: NonNullable<Json>;
          integration_status?: Database['public']['Enums']['integration_status'];
          kind: Database['public']['Enums']['payment_kind'];
          max_usd?: number | null;
          min_usd?: number;
          name: string;
          quote_ttl_minutes?: number;
          rail: string;
          reference_pattern?: string | null;
          requires_proof?: boolean;
          requires_reference?: boolean;
          sort?: number;
        };
        Update: {
          code?: string;
          currency?: string;
          description?: string | null;
          enabled?: boolean;
          fee_fixed_usd?: number;
          fee_pct?: number;
          instructions?: NonNullable<Json>;
          integration_status?: Database['public']['Enums']['integration_status'];
          kind?: Database['public']['Enums']['payment_kind'];
          max_usd?: number | null;
          min_usd?: number;
          name?: string;
          quote_ttl_minutes?: number;
          rail?: string;
          reference_pattern?: string | null;
          requires_proof?: boolean;
          requires_reference?: boolean;
          sort?: number;
        };
        Relationships: [];
      };
      payment_obligations: {
        Row: {
          amount_usd: number;
          due_date: string | null;
          id: string;
          kind: Database['public']['Enums']['obligation_kind'];
          order_id: string;
          paid_usd: number;
          seq: number;
          status: Database['public']['Enums']['obligation_status'];
          updated_at: string;
          waived_usd: number;
          _outstanding: number | null;
        };
        ComputedFields: '_outstanding';
        Insert: {
          amount_usd: number;
          due_date?: string | null;
          id?: string;
          kind: Database['public']['Enums']['obligation_kind'];
          order_id: string;
          paid_usd?: number;
          seq: number;
          status?: Database['public']['Enums']['obligation_status'];
          updated_at?: string;
          waived_usd?: number;
        };
        Update: {
          amount_usd?: number;
          due_date?: string | null;
          id?: string;
          kind?: Database['public']['Enums']['obligation_kind'];
          order_id?: string;
          paid_usd?: number;
          seq?: number;
          status?: Database['public']['Enums']['obligation_status'];
          updated_at?: string;
          waived_usd?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'payment_obligations_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      payment_quotes: {
        Row: {
          amount_due: number;
          base_usd: number;
          buyer_id: string;
          currency: string;
          expires_at: string;
          fee_usd: number;
          id: string;
          issued_at: string;
          method_code: string;
          obligation_ids: string[];
          order_id: string;
          rate_applied: number;
          rate_base: number;
          rate_observed_at: string;
          rate_pair: string;
          rate_source: string;
          status: Database['public']['Enums']['quote_status'];
          used_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          amount_due: number;
          base_usd: number;
          buyer_id: string;
          currency: string;
          expires_at: string;
          fee_usd?: number;
          id?: string;
          issued_at?: string;
          method_code: string;
          obligation_ids: string[];
          order_id: string;
          rate_applied: number;
          rate_base: number;
          rate_observed_at: string;
          rate_pair: string;
          rate_source: string;
          status?: Database['public']['Enums']['quote_status'];
          used_at?: string | null;
        };
        Update: {
          amount_due?: number;
          base_usd?: number;
          buyer_id?: string;
          currency?: string;
          expires_at?: string;
          fee_usd?: number;
          id?: string;
          issued_at?: string;
          method_code?: string;
          obligation_ids?: string[];
          order_id?: string;
          rate_applied?: number;
          rate_base?: number;
          rate_observed_at?: string;
          rate_pair?: string;
          rate_source?: string;
          status?: Database['public']['Enums']['quote_status'];
          used_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'payment_quotes_method_code_fkey';
            columns: ['method_code'];
            isOneToOne: false;
            referencedRelation: 'payment_methods';
            referencedColumns: ['code'];
          },
          {
            foreignKeyName: 'payment_quotes_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          amount_received: number | null;
          base_usd: number;
          buyer_id: string;
          created_at: string;
          currency: string;
          declared_paid_at: string | null;
          fee_usd: number;
          id: string;
          idempotency_key: string;
          method_code: string;
          number: string;
          order_id: string;
          payer_bank: string | null;
          payer_name: string | null;
          payer_phone: string | null;
          proof_path: string | null;
          provider: string | null;
          provider_checkout_url: string | null;
          provider_payment_id: string | null;
          quote_id: string;
          rate_applied: number;
          reference: string | null;
          reference_normalized: string | null;
          rejection_reason: string | null;
          status: Database['public']['Enums']['payment_status'];
          updated_at: string;
          usd_recognized: number | null;
          verified_at: string | null;
          verified_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          amount_received?: number | null;
          base_usd: number;
          buyer_id: string;
          created_at?: string;
          currency: string;
          declared_paid_at?: string | null;
          fee_usd?: number;
          id?: string;
          idempotency_key: string;
          method_code: string;
          number: string;
          order_id: string;
          payer_bank?: string | null;
          payer_name?: string | null;
          payer_phone?: string | null;
          proof_path?: string | null;
          provider?: string | null;
          provider_checkout_url?: string | null;
          provider_payment_id?: string | null;
          quote_id: string;
          rate_applied: number;
          reference?: string | null;
          reference_normalized?: string | null;
          rejection_reason?: string | null;
          status?: Database['public']['Enums']['payment_status'];
          updated_at?: string;
          usd_recognized?: number | null;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          amount?: number;
          amount_received?: number | null;
          base_usd?: number;
          buyer_id?: string;
          created_at?: string;
          currency?: string;
          declared_paid_at?: string | null;
          fee_usd?: number;
          id?: string;
          idempotency_key?: string;
          method_code?: string;
          number?: string;
          order_id?: string;
          payer_bank?: string | null;
          payer_name?: string | null;
          payer_phone?: string | null;
          proof_path?: string | null;
          provider?: string | null;
          provider_checkout_url?: string | null;
          provider_payment_id?: string | null;
          quote_id?: string;
          rate_applied?: number;
          reference?: string | null;
          reference_normalized?: string | null;
          rejection_reason?: string | null;
          status?: Database['public']['Enums']['payment_status'];
          updated_at?: string;
          usd_recognized?: number | null;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'payments_method_code_fkey';
            columns: ['method_code'];
            isOneToOne: false;
            referencedRelation: 'payment_methods';
            referencedColumns: ['code'];
          },
          {
            foreignKeyName: 'payments_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payments_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: true;
            referencedRelation: 'payment_quotes';
            referencedColumns: ['id'];
          },
        ];
      };
      payouts: {
        Row: {
          amount_usd: number;
          created_at: string;
          created_by: string | null;
          id: string;
          method: string | null;
          notes: string | null;
          paid_at: string | null;
          paid_by: string | null;
          reference: string | null;
          status: Database['public']['Enums']['payout_status'];
          store_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount_usd: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          method?: string | null;
          notes?: string | null;
          paid_at?: string | null;
          paid_by?: string | null;
          reference?: string | null;
          status?: Database['public']['Enums']['payout_status'];
          store_id: string;
        };
        Update: {
          amount_usd?: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          method?: string | null;
          notes?: string | null;
          paid_at?: string | null;
          paid_by?: string | null;
          reference?: string | null;
          status?: Database['public']['Enums']['payout_status'];
          store_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payouts_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
      pickup_points: {
        Row: {
          active: boolean;
          address: string;
          carrier_id: string;
          city: string;
          country_code: string;
          id: string;
          is_demo: boolean;
          name: string;
          region_code: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          address: string;
          carrier_id: string;
          city: string;
          country_code?: string;
          id?: string;
          is_demo?: boolean;
          name: string;
          region_code: string;
        };
        Update: {
          active?: boolean;
          address?: string;
          carrier_id?: string;
          city?: string;
          country_code?: string;
          id?: string;
          is_demo?: boolean;
          name?: string;
          region_code?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pickup_points_carrier_id_fkey';
            columns: ['carrier_id'];
            isOneToOne: false;
            referencedRelation: 'carriers';
            referencedColumns: ['id'];
          },
        ];
      };
      product_images: {
        Row: {
          alt: string | null;
          created_at: string;
          height: number | null;
          id: string;
          is_demo_asset: boolean;
          path: string;
          product_id: string;
          sort: number;
          width: number | null;
        };
        ComputedFields: never;
        Insert: {
          alt?: string | null;
          created_at?: string;
          height?: number | null;
          id?: string;
          is_demo_asset?: boolean;
          path: string;
          product_id: string;
          sort?: number;
          width?: number | null;
        };
        Update: {
          alt?: string | null;
          created_at?: string;
          height?: number | null;
          id?: string;
          is_demo_asset?: boolean;
          path?: string;
          product_id?: string;
          sort?: number;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'product_images_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'product_cards';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'product_images_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      product_variants: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          options: NonNullable<Json>;
          price_usd: number;
          product_id: string;
          sku: string | null;
          sort: number;
          stock: number | null;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          options?: NonNullable<Json>;
          price_usd: number;
          product_id: string;
          sku?: string | null;
          sort?: number;
          stock?: number | null;
          title?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          options?: NonNullable<Json>;
          price_usd?: number;
          product_id?: string;
          sku?: string | null;
          sort?: number;
          stock?: number | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'product_variants_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'product_cards';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'product_variants_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      products: {
        Row: {
          availability: Database['public']['Enums']['availability'];
          base_price_usd: number;
          brand_id: string | null;
          category_id: string;
          compare_at_usd: number | null;
          created_at: string;
          description: string | null;
          highlights: string[];
          id: string;
          is_demo: boolean;
          max_per_order: number;
          moderation_note: string | null;
          moderation_status: Database['public']['Enums']['moderation_status'];
          option_names: string[];
          origin: Database['public']['Enums']['product_origin'];
          popularity: number;
          published_at: string | null;
          search: unknown;
          slug: string;
          source_provider: string | null;
          source_url: string | null;
          store_id: string;
          subtitle: string | null;
          title: string;
          updated_at: string;
          weight_kg: number;
        };
        ComputedFields: never;
        Insert: {
          availability?: Database['public']['Enums']['availability'];
          base_price_usd?: number;
          brand_id?: string | null;
          category_id: string;
          compare_at_usd?: number | null;
          created_at?: string;
          description?: string | null;
          highlights?: string[];
          id?: string;
          is_demo?: boolean;
          max_per_order?: number;
          moderation_note?: string | null;
          moderation_status?: Database['public']['Enums']['moderation_status'];
          option_names?: string[];
          origin?: Database['public']['Enums']['product_origin'];
          popularity?: number;
          published_at?: string | null;
          search?: unknown;
          slug: string;
          source_provider?: string | null;
          source_url?: string | null;
          store_id: string;
          subtitle?: string | null;
          title: string;
          updated_at?: string;
          weight_kg?: number;
        };
        Update: {
          availability?: Database['public']['Enums']['availability'];
          base_price_usd?: number;
          brand_id?: string | null;
          category_id?: string;
          compare_at_usd?: number | null;
          created_at?: string;
          description?: string | null;
          highlights?: string[];
          id?: string;
          is_demo?: boolean;
          max_per_order?: number;
          moderation_note?: string | null;
          moderation_status?: Database['public']['Enums']['moderation_status'];
          option_names?: string[];
          origin?: Database['public']['Enums']['product_origin'];
          popularity?: number;
          published_at?: string | null;
          search?: unknown;
          slug?: string;
          source_provider?: string | null;
          source_url?: string | null;
          store_id?: string;
          subtitle?: string | null;
          title?: string;
          updated_at?: string;
          weight_kg?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'products_brand_id_fkey';
            columns: ['brand_id'];
            isOneToOne: false;
            referencedRelation: 'brands';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'products_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'products_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
          is_demo: boolean;
          marketing_opt_in: boolean;
          personalization_enabled: boolean;
          phone: string | null;
          preferences: NonNullable<Json>;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_path?: string | null;
          created_at?: string;
          full_name?: string | null;
          id: string;
          is_demo?: boolean;
          marketing_opt_in?: boolean;
          personalization_enabled?: boolean;
          phone?: string | null;
          preferences?: NonNullable<Json>;
          updated_at?: string;
        };
        Update: {
          avatar_path?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          is_demo?: boolean;
          marketing_opt_in?: boolean;
          personalization_enabled?: boolean;
          phone?: string | null;
          preferences?: NonNullable<Json>;
          updated_at?: string;
        };
        Relationships: [];
      };
      push_tokens: {
        Row: {
          created_at: string;
          last_seen_at: string;
          platform: string;
          token: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          last_seen_at?: string;
          platform: string;
          token: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          last_seen_at?: string;
          platform?: string;
          token?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      rate_limits: {
        Row: {
          action: string;
          hits: number;
          user_id: string;
          window_start: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          hits?: number;
          user_id: string;
          window_start: string;
        };
        Update: {
          action?: string;
          hits?: number;
          user_id?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      rate_policies: {
        Row: {
          enabled: boolean;
          fallback_sources: string[];
          manual_note: string | null;
          manual_rate: number | null;
          manual_valid_until: string | null;
          margin_pct: number;
          max_age_minutes: number;
          pair: string;
          primary_source: string;
          rounding_decimals: number;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          enabled?: boolean;
          fallback_sources?: string[];
          manual_note?: string | null;
          manual_rate?: number | null;
          manual_valid_until?: string | null;
          margin_pct?: number;
          max_age_minutes?: number;
          pair: string;
          primary_source: string;
          rounding_decimals?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          enabled?: boolean;
          fallback_sources?: string[];
          manual_note?: string | null;
          manual_rate?: number | null;
          manual_valid_until?: string | null;
          margin_pct?: number;
          max_age_minutes?: number;
          pair?: string;
          primary_source?: string;
          rounding_decimals?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'rate_policies_primary_source_fkey';
            columns: ['primary_source'];
            isOneToOne: false;
            referencedRelation: 'exchange_rate_sources';
            referencedColumns: ['code'];
          },
        ];
      };
      refunds: {
        Row: {
          amount_usd: number;
          created_at: string;
          created_by: string | null;
          id: string;
          order_id: string;
          order_item_id: string | null;
          quantity: number;
          reason: string;
          restock: boolean;
        };
        ComputedFields: never;
        Insert: {
          amount_usd: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          order_id: string;
          order_item_id?: string | null;
          quantity?: number;
          reason: string;
          restock?: boolean;
        };
        Update: {
          amount_usd?: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          order_id?: string;
          order_item_id?: string | null;
          quantity?: number;
          reason?: string;
          restock?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'refunds_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'refunds_order_item_id_fkey';
            columns: ['order_item_id'];
            isOneToOne: false;
            referencedRelation: 'order_items';
            referencedColumns: ['id'];
          },
        ];
      };
      regions: {
        Row: {
          code: string;
          country_code: string;
          name: string;
          sort: number;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          country_code?: string;
          name: string;
          sort?: number;
        };
        Update: {
          code?: string;
          country_code?: string;
          name?: string;
          sort?: number;
        };
        Relationships: [];
      };
      shipping_methods: {
        Row: {
          active: boolean;
          carrier_id: string | null;
          code: string;
          description: string | null;
          id: string;
          kind: Database['public']['Enums']['shipping_kind'];
          name: string;
          sort: number;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          carrier_id?: string | null;
          code: string;
          description?: string | null;
          id?: string;
          kind: Database['public']['Enums']['shipping_kind'];
          name: string;
          sort?: number;
        };
        Update: {
          active?: boolean;
          carrier_id?: string | null;
          code?: string;
          description?: string | null;
          id?: string;
          kind?: Database['public']['Enums']['shipping_kind'];
          name?: string;
          sort?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'shipping_methods_carrier_id_fkey';
            columns: ['carrier_id'];
            isOneToOne: false;
            referencedRelation: 'carriers';
            referencedColumns: ['id'];
          },
        ];
      };
      shipping_rates: {
        Row: {
          active: boolean;
          base_usd: number;
          flows: Database['public']['Enums']['fulfillment_flow'][];
          free_over_usd: number | null;
          id: string;
          is_demo: boolean;
          max_days: number;
          max_weight_kg: number | null;
          method_id: string;
          min_days: number;
          per_kg_usd: number;
          store_id: string | null;
          zone_id: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          base_usd: number;
          flows?: Database['public']['Enums']['fulfillment_flow'][];
          free_over_usd?: number | null;
          id?: string;
          is_demo?: boolean;
          max_days: number;
          max_weight_kg?: number | null;
          method_id: string;
          min_days: number;
          per_kg_usd?: number;
          store_id?: string | null;
          zone_id: string;
        };
        Update: {
          active?: boolean;
          base_usd?: number;
          flows?: Database['public']['Enums']['fulfillment_flow'][];
          free_over_usd?: number | null;
          id?: string;
          is_demo?: boolean;
          max_days?: number;
          max_weight_kg?: number | null;
          method_id?: string;
          min_days?: number;
          per_kg_usd?: number;
          store_id?: string | null;
          zone_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'shipping_rates_method_id_fkey';
            columns: ['method_id'];
            isOneToOne: false;
            referencedRelation: 'shipping_methods';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'shipping_rates_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'shipping_rates_zone_id_fkey';
            columns: ['zone_id'];
            isOneToOne: false;
            referencedRelation: 'shipping_zones';
            referencedColumns: ['id'];
          },
        ];
      };
      shipping_zones: {
        Row: {
          code: string;
          country_code: string;
          id: string;
          name: string;
          region_codes: string[];
        };
        ComputedFields: never;
        Insert: {
          code: string;
          country_code?: string;
          id?: string;
          name: string;
          region_codes: string[];
        };
        Update: {
          code?: string;
          country_code?: string;
          id?: string;
          name?: string;
          region_codes?: string[];
        };
        Relationships: [];
      };
      stock_alerts: {
        Row: {
          created_at: string;
          notified_at: string | null;
          product_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          notified_at?: string | null;
          product_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          notified_at?: string | null;
          product_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'stock_alerts_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'product_cards';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stock_alerts_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      store_members: {
        Row: {
          created_at: string;
          role: Database['public']['Enums']['store_member_role'];
          store_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          role?: Database['public']['Enums']['store_member_role'];
          store_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          role?: Database['public']['Enums']['store_member_role'];
          store_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'store_members_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
      stores: {
        Row: {
          accent: string;
          contact_email: string | null;
          cover_path: string | null;
          created_at: string;
          description: string | null;
          id: string;
          is_demo: boolean;
          kind: Database['public']['Enums']['store_kind'];
          logo_path: string | null;
          name: string;
          policies: NonNullable<Json>;
          rating_avg: number | null;
          rating_count: number;
          shipping_info: string | null;
          slug: string;
          status: Database['public']['Enums']['store_status'];
          tagline: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          accent?: string;
          contact_email?: string | null;
          cover_path?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_demo?: boolean;
          kind?: Database['public']['Enums']['store_kind'];
          logo_path?: string | null;
          name: string;
          policies?: NonNullable<Json>;
          rating_avg?: number | null;
          rating_count?: number;
          shipping_info?: string | null;
          slug: string;
          status?: Database['public']['Enums']['store_status'];
          tagline?: string | null;
          updated_at?: string;
        };
        Update: {
          accent?: string;
          contact_email?: string | null;
          cover_path?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_demo?: boolean;
          kind?: Database['public']['Enums']['store_kind'];
          logo_path?: string | null;
          name?: string;
          policies?: NonNullable<Json>;
          rating_avg?: number | null;
          rating_count?: number;
          shipping_info?: string | null;
          slug?: string;
          status?: Database['public']['Enums']['store_status'];
          tagline?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      url_imports: {
        Row: {
          created_at: string;
          created_by: string | null;
          extracted: Json | null;
          id: string;
          message: string | null;
          product_id: string | null;
          provider: string | null;
          status: string;
          url: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          extracted?: Json | null;
          id?: string;
          message?: string | null;
          product_id?: string | null;
          provider?: string | null;
          status?: string;
          url: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          extracted?: Json | null;
          id?: string;
          message?: string | null;
          product_id?: string | null;
          provider?: string | null;
          status?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'url_imports_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'product_cards';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'url_imports_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      user_events: {
        Row: {
          category_id: string | null;
          created_at: string;
          id: number;
          kind: Database['public']['Enums']['user_event_kind'];
          product_id: string | null;
          query: string | null;
          store_id: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          category_id?: string | null;
          created_at?: string;
          id?: never;
          kind: Database['public']['Enums']['user_event_kind'];
          product_id?: string | null;
          query?: string | null;
          store_id?: string | null;
          user_id: string;
        };
        Update: {
          category_id?: string | null;
          created_at?: string;
          id?: never;
          kind?: Database['public']['Enums']['user_event_kind'];
          product_id?: string | null;
          query?: string | null;
          store_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_events_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_events_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'product_cards';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_events_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_events_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
      user_roles: {
        Row: {
          granted_at: string;
          granted_by: string | null;
          role: Database['public']['Enums']['app_role'];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          granted_at?: string;
          granted_by?: string | null;
          role: Database['public']['Enums']['app_role'];
          user_id: string;
        };
        Update: {
          granted_at?: string;
          granted_by?: string | null;
          role?: Database['public']['Enums']['app_role'];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      product_cards: {
        Row: {
          availability: Database['public']['Enums']['availability'] | null;
          brand_name: string | null;
          category_id: string | null;
          category_name: string | null;
          category_slug: string | null;
          compare_at_usd: number | null;
          id: string | null;
          image_path: string | null;
          is_demo: boolean | null;
          lead_max_days: number | null;
          lead_min_days: number | null;
          moderation_status: Database['public']['Enums']['moderation_status'] | null;
          origin: Database['public']['Enums']['product_origin'] | null;
          popularity: number | null;
          price_usd: number | null;
          published_at: string | null;
          slug: string | null;
          stock_total: number | null;
          store_id: string | null;
          store_kind: Database['public']['Enums']['store_kind'] | null;
          store_name: string | null;
          store_slug: string | null;
          store_status: Database['public']['Enums']['store_status'] | null;
          subtitle: string | null;
          title: string | null;
          tone: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: 'products_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'products_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Functions: {
      _apply_payment: {
        Args: { p_actor_note: string; p_fee: number; p_payment_id: string; p_usd: number };
        Returns: undefined;
      };
      _build_checkout: {
        Args: { p_address_id: string; p_plan_code: string; p_shipping: Json; p_user: string };
        Returns: Json;
      };
      _cancel_fulfillment: { Args: { p_fulfillment_id: string; p_reason: string }; Returns: number };
      _cart_lines: {
        Args: { p_user: string };
        Returns: {
          availability: Database['public']['Enums']['availability'];
          category_id: string;
          flow: Database['public']['Enums']['fulfillment_flow'];
          group_key: string;
          image_path: string;
          issue: string;
          max_per_order: number;
          moderation: Database['public']['Enums']['moderation_status'];
          origin: Database['public']['Enums']['product_origin'];
          product_id: string;
          quantity: number;
          ready_max: number;
          ready_min: number;
          stock: number;
          store_id: string;
          store_kind: Database['public']['Enums']['store_kind'];
          store_name: string;
          store_slug: string;
          store_status: Database['public']['Enums']['store_status'];
          title: string;
          unit_price_usd: number;
          variant_active: boolean;
          variant_id: string;
          variant_title: string;
          weight_kg: number;
        }[];
      };
      _group_label: {
        Args: { p_flow: Database['public']['Enums']['fulfillment_flow']; p_key: string; p_store_name: string };
        Returns: string;
      };
      _order_payment_level: { Args: { p_order_id: string }; Returns: string };
      _outstanding: {
        Args: {
          p_ob: Omit<
            Database['public']['Tables']['payment_obligations']['Row'],
            Database['public']['Tables']['payment_obligations']['ComputedFields']
          >;
        };
        Returns: number;
      };
      _plan_schedule: {
        Args: {
          p_plan: Omit<
            Database['public']['Tables']['installment_plans']['Row'],
            Database['public']['Tables']['installment_plans']['ComputedFields']
          >;
          p_total: number;
        };
        Returns: Json;
      };
      _recompute_order: { Args: { p_order_id: string }; Returns: undefined };
      _reduce_buyer_debt: { Args: { p_amount: number; p_event: string; p_order_id: string }; Returns: number };
      _set_fulfillment_step: {
        Args: {
          p_carrier: string;
          p_fulfillment_id: string;
          p_note: string;
          p_source: string;
          p_step: string;
          p_tracking: string;
        };
        Returns: undefined;
      };
      _settle_fulfillment: { Args: { p_fulfillment_id: string }; Returns: undefined };
      add_store_member: {
        Args: { p_email: string; p_role?: Database['public']['Enums']['store_member_role']; p_store_id: string };
        Returns: string;
      };
      admin_dashboard: { Args: Record<PropertyKey, never>; Returns: Json };
      admin_users: { Args: { p_limit?: number; p_query?: string }; Returns: Json };
      advance_fulfillment: {
        Args: { p_carrier?: string; p_fulfillment_id: string; p_note?: string; p_step: string; p_tracking?: string };
        Returns: undefined;
      };
      assign_to_batch: { Args: { p_batch_id: string; p_fulfillment_ids: string[] }; Returns: number };
      attach_provider_payment: {
        Args: { p_checkout_url?: string; p_payment_id: string; p_provider_payment_id: string };
        Returns: undefined;
      };
      audit: { Args: { p_action: string; p_data?: Json; p_entity: string; p_entity_id: string }; Returns: undefined };
      cancel_order: { Args: { p_order_id: string; p_reason: string }; Returns: undefined };
      cancel_payout: { Args: { p_payout_id: string }; Returns: undefined };
      cancel_provider_payment: { Args: { p_payment_id: string }; Returns: undefined };
      cart_add: { Args: { p_quantity?: number; p_variant_id: string }; Returns: Json };
      cart_merge: { Args: { p_lines: Json }; Returns: number };
      cart_set_quantity: { Args: { p_quantity: number; p_variant_id: string }; Returns: Json };
      cart_summary: { Args: { p_address_id?: string }; Returns: Json };
      check_rate_limit: { Args: { p_action: string; p_max: number; p_window_seconds: number }; Returns: undefined };
      checkout_preview: { Args: { p_address_id: string; p_plan_code?: string; p_shipping?: Json }; Returns: Json };
      claim_push_batch: { Args: { p_ids?: string[]; p_limit?: number }; Returns: Json };
      clear_my_activity: { Args: Record<PropertyKey, never>; Returns: undefined };
      commission_pct: { Args: { p_category_id: string; p_store_id: string }; Returns: number };
      complete_push: { Args: { p_dead_tokens?: string[]; p_results: Json }; Returns: undefined };
      create_payment_quote: {
        Args: { p_method_code: string; p_obligation_ids?: string[]; p_order_id: string };
        Returns: Json;
      };
      create_payout: { Args: { p_amount: number; p_notes?: string; p_store_id: string }; Returns: string };
      current_rate: {
        Args: { p_pair: string };
        Returns: {
          is_fallback: boolean;
          is_manual: boolean;
          observed_at: string;
          rate_applied: number;
          rate_base: number;
          source_code: string;
        }[];
      };
      custom_access_token_hook: { Args: { event: Json }; Returns: Json };
      dev_refresh_demo_rates: { Args: Record<PropertyKey, never>; Returns: undefined };
      escalate_claim: { Args: { p_claim_id: string }; Returns: undefined };
      expire_unpaid_orders: { Args: Record<PropertyKey, never>; Returns: number };
      fail_provider_start: { Args: { p_payment_id: string; p_reason: string }; Returns: undefined };
      flow_for: {
        Args: {
          p_origin: Database['public']['Enums']['product_origin'];
          p_store_kind: Database['public']['Enums']['store_kind'];
        };
        Returns: Database['public']['Enums']['fulfillment_flow'];
      };
      has_role: { Args: { p_role: Database['public']['Enums']['app_role'] }; Returns: boolean };
      home_feed: { Args: Record<PropertyKey, never>; Returns: Json };
      ingest_rate: {
        Args: {
          p_force?: boolean;
          p_observed_at: string;
          p_pair: string;
          p_rate: number;
          p_raw?: Json;
          p_source: string;
        };
        Returns: number;
      };
      invoke_edge_function: { Args: { p_body?: Json; p_name: string }; Returns: number };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_service_role: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_store_member: { Args: { p_store_id: string }; Returns: boolean };
      is_superadmin: { Args: Record<PropertyKey, never>; Returns: boolean };
      lead_time: {
        Args: { p_product_id: string };
        Returns: {
          max_days: number;
          min_days: number;
        }[];
      };
      ledger_post: {
        Args: {
          p_event: string;
          p_fulfillment_id?: string;
          p_legs: Json;
          p_memo?: string;
          p_order_id?: string;
          p_payment_id?: string;
          p_payout_id?: string;
        };
        Returns: string;
      };
      mark_notifications_read: { Args: { p_ids?: string[] }; Returns: number };
      mark_payout_paid: { Args: { p_method: string; p_payout_id: string; p_reference: string }; Returns: undefined };
      moderate_product: {
        Args: { p_note?: string; p_product_id: string; p_status: Database['public']['Enums']['moderation_status'] };
        Returns: undefined;
      };
      notify: {
        Args: { p_body: string; p_data?: Json; p_kind: string; p_title: string; p_user: string };
        Returns: string;
      };
      notify_store: {
        Args: { p_body: string; p_data?: Json; p_kind: string; p_store: string; p_title: string };
        Returns: undefined;
      };
      open_claim: { Args: { p_description: string; p_fulfillment_id: string; p_reason: string }; Returns: string };
      place_order: {
        Args: { p_address_id: string; p_idempotency_key: string; p_plan_code: string; p_shipping: Json };
        Returns: Json;
      };
      post_adjustment: { Args: { p_amount: number; p_memo: string; p_store_id: string }; Returns: string };
      post_claim_message: { Args: { p_body: string; p_claim_id: string }; Returns: undefined };
      process_account_deletion: {
        Args: { p_approve: boolean; p_notes?: string; p_request_id: string };
        Returns: undefined;
      };
      product_detail: { Args: { p_id: string }; Returns: Json };
      publish_import: {
        Args: { p_images?: Json; p_import_id: string; p_product: Json; p_variants?: Json };
        Returns: string;
      };
      rate_status: { Args: { p_pair?: string }; Returns: Json };
      recently_viewed: {
        Args: { p_limit?: number };
        Returns: {
          availability: Database['public']['Enums']['availability'] | null;
          brand_name: string | null;
          category_id: string | null;
          category_name: string | null;
          category_slug: string | null;
          compare_at_usd: number | null;
          id: string | null;
          image_path: string | null;
          is_demo: boolean | null;
          lead_max_days: number | null;
          lead_min_days: number | null;
          moderation_status: Database['public']['Enums']['moderation_status'] | null;
          origin: Database['public']['Enums']['product_origin'] | null;
          popularity: number | null;
          price_usd: number | null;
          published_at: string | null;
          slug: string | null;
          stock_total: number | null;
          store_id: string | null;
          store_kind: Database['public']['Enums']['store_kind'] | null;
          store_name: string | null;
          store_slug: string | null;
          store_status: Database['public']['Enums']['store_status'] | null;
          subtitle: string | null;
          title: string | null;
          tone: string | null;
        }[];
        SetofOptions: {
          from: '*';
          to: 'product_cards';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      recommended_products: {
        Args: { p_exclude?: string[]; p_limit?: number };
        Returns: {
          availability: Database['public']['Enums']['availability'] | null;
          brand_name: string | null;
          category_id: string | null;
          category_name: string | null;
          category_slug: string | null;
          compare_at_usd: number | null;
          id: string | null;
          image_path: string | null;
          is_demo: boolean | null;
          lead_max_days: number | null;
          lead_min_days: number | null;
          moderation_status: Database['public']['Enums']['moderation_status'] | null;
          origin: Database['public']['Enums']['product_origin'] | null;
          popularity: number | null;
          price_usd: number | null;
          published_at: string | null;
          slug: string | null;
          stock_total: number | null;
          store_id: string | null;
          store_kind: Database['public']['Enums']['store_kind'] | null;
          store_name: string | null;
          store_slug: string | null;
          store_status: Database['public']['Enums']['store_status'] | null;
          subtitle: string | null;
          title: string | null;
          tone: string | null;
        }[];
        SetofOptions: {
          from: '*';
          to: 'product_cards';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      record_provider_event: {
        Args: {
          p_amount: number;
          p_currency: string;
          p_event_id: string;
          p_event_type: string;
          p_outcome: string;
          p_payload: Json;
          p_provider: string;
          p_provider_payment_id: string;
          p_signature_valid: boolean;
        };
        Returns: Json;
      };
      record_refund_payout: {
        Args: { p_amount: number; p_method: string; p_order_id: string; p_reference: string };
        Returns: undefined;
      };
      refresh_popularity: { Args: Record<PropertyKey, never>; Returns: undefined };
      refund_item: {
        Args: { p_order_item_id: string; p_quantity: number; p_reason: string; p_restock?: boolean };
        Returns: Json;
      };
      register_push_token: { Args: { p_platform: string; p_token: string }; Returns: undefined };
      request_account_deletion: { Args: { p_reason?: string }; Returns: string };
      require_admin: { Args: Record<PropertyKey, never>; Returns: undefined };
      require_store_member: { Args: { p_store_id: string }; Returns: undefined };
      require_user: { Args: Record<PropertyKey, never>; Returns: string };
      resolve_claim: {
        Args: { p_claim_id: string; p_resolution: string; p_status: Database['public']['Enums']['claim_status'] };
        Returns: undefined;
      };
      review_payment: {
        Args: { p_amount_received?: number; p_approve: boolean; p_payment_id: string; p_reason?: string };
        Returns: Json;
      };
      search_products: {
        Args: {
          p_availability?: Database['public']['Enums']['availability'][];
          p_category?: string;
          p_collection?: string;
          p_limit?: number;
          p_max_price?: number;
          p_min_price?: number;
          p_offset?: number;
          p_query?: string;
          p_sort?: string;
          p_store?: string;
        };
        Returns: {
          availability: Database['public']['Enums']['availability'] | null;
          brand_name: string | null;
          category_id: string | null;
          category_name: string | null;
          category_slug: string | null;
          compare_at_usd: number | null;
          id: string | null;
          image_path: string | null;
          is_demo: boolean | null;
          lead_max_days: number | null;
          lead_min_days: number | null;
          moderation_status: Database['public']['Enums']['moderation_status'] | null;
          origin: Database['public']['Enums']['product_origin'] | null;
          popularity: number | null;
          price_usd: number | null;
          published_at: string | null;
          slug: string | null;
          stock_total: number | null;
          store_id: string | null;
          store_kind: Database['public']['Enums']['store_kind'] | null;
          store_name: string | null;
          store_slug: string | null;
          store_status: Database['public']['Enums']['store_status'] | null;
          subtitle: string | null;
          title: string | null;
          tone: string | null;
        }[];
        SetofOptions: {
          from: '*';
          to: 'product_cards';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      seller_balance: { Args: { p_store_id: string }; Returns: Json };
      seller_dashboard: { Args: { p_store_id: string }; Returns: Json };
      seller_fulfillments: { Args: { p_scope?: string; p_store_id: string }; Returns: Json };
      seller_sales: { Args: { p_days?: number; p_store_id: string }; Returns: Json };
      set_manual_rate: {
        Args: { p_note: string; p_pair: string; p_rate: number; p_valid_minutes: number };
        Returns: undefined;
      };
      set_user_role: {
        Args: { p_grant: boolean; p_role: Database['public']['Enums']['app_role']; p_user_id: string };
        Returns: undefined;
      };
      setting: { Args: { p_default?: Json; p_key: string }; Returns: Json };
      shipping_options: {
        Args: {
          p_country_code?: string;
          p_flow: Database['public']['Enums']['fulfillment_flow'];
          p_region_code: string;
          p_store_id: string;
          p_subtotal_usd: number;
          p_weight_kg: number;
        };
        Returns: {
          carrier_name: string;
          cost_usd: number;
          is_demo: boolean;
          kind: Database['public']['Enums']['shipping_kind'];
          max_days: number;
          method_code: string;
          method_id: string;
          method_name: string;
          min_days: number;
        }[];
      };
      slugify: { Args: { p: string }; Returns: string };
      start_provider_payment: { Args: { p_idempotency_key: string; p_quote_id: string }; Returns: Json };
      submit_payment: {
        Args: {
          p_idempotency_key: string;
          p_payer: Json;
          p_proof_path: string;
          p_quote_id: string;
          p_reference: string;
        };
        Returns: Json;
      };
      track_event: {
        Args: {
          p_category_id?: string;
          p_kind: Database['public']['Enums']['user_event_kind'];
          p_product_id?: string;
          p_query?: string;
          p_store_id?: string;
        };
        Returns: undefined;
      };
      update_cargo_batch: { Args: { p_batch_id: string; p_note?: string; p_step: string }; Returns: Json };
    };
    Enums: {
      app_role: 'admin' | 'superadmin';
      availability: 'available' | 'on_order' | 'in_transit' | 'reservable' | 'sold_out' | 'unavailable';
      claim_status: 'open' | 'seller_responded' | 'escalated' | 'resolved' | 'rejected';
      fulfillment_flow: 'local_stock' | 'import_order' | 'seller_shipping';
      integration_status: 'live' | 'sandbox' | 'pending_credentials' | 'disabled';
      ledger_account:
        | 'buyer_receivable'
        | 'deferred_revenue'
        | 'cash_clearing'
        | 'fee_revenue'
        | 'sales_revenue'
        | 'commission_revenue'
        | 'seller_payable'
        | 'buyer_refund_payable'
        | 'adjustments';
      moderation_status: 'pending' | 'published' | 'in_review' | 'rejected' | 'suspended';
      obligation_kind: 'full' | 'down_payment' | 'installment';
      obligation_status: 'pending' | 'partially_paid' | 'paid' | 'cancelled';
      order_payment_status: 'unpaid' | 'partially_paid' | 'paid' | 'refund_due' | 'refunded';
      order_status: 'placed' | 'in_progress' | 'completed' | 'cancelled';
      payment_kind: 'manual' | 'automated';
      payment_status: 'pending_verification' | 'processing' | 'confirmed' | 'rejected' | 'refunded' | 'failed';
      payout_status: 'draft' | 'paid' | 'cancelled';
      product_origin: 'local' | 'import' | 'seller';
      quote_status: 'open' | 'used' | 'expired' | 'cancelled';
      rate_source_kind: 'official' | 'market_reference' | 'manual';
      risk_level: 'low' | 'restricted' | 'regulated';
      shipping_kind: 'home_delivery' | 'office_pickup' | 'store_pickup';
      store_kind: 'platform' | 'seller';
      store_member_role: 'owner' | 'staff';
      store_status: 'pending' | 'active' | 'suspended';
      user_event_kind: 'view' | 'search' | 'favorite' | 'add_to_cart' | 'purchase' | 'category_view' | 'store_view';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema['Tables'] & DefaultSchema['Views']) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ['admin', 'superadmin'],
      availability: ['available', 'on_order', 'in_transit', 'reservable', 'sold_out', 'unavailable'],
      claim_status: ['open', 'seller_responded', 'escalated', 'resolved', 'rejected'],
      fulfillment_flow: ['local_stock', 'import_order', 'seller_shipping'],
      integration_status: ['live', 'sandbox', 'pending_credentials', 'disabled'],
      ledger_account: [
        'buyer_receivable',
        'deferred_revenue',
        'cash_clearing',
        'fee_revenue',
        'sales_revenue',
        'commission_revenue',
        'seller_payable',
        'buyer_refund_payable',
        'adjustments',
      ],
      moderation_status: ['pending', 'published', 'in_review', 'rejected', 'suspended'],
      obligation_kind: ['full', 'down_payment', 'installment'],
      obligation_status: ['pending', 'partially_paid', 'paid', 'cancelled'],
      order_payment_status: ['unpaid', 'partially_paid', 'paid', 'refund_due', 'refunded'],
      order_status: ['placed', 'in_progress', 'completed', 'cancelled'],
      payment_kind: ['manual', 'automated'],
      payment_status: ['pending_verification', 'processing', 'confirmed', 'rejected', 'refunded', 'failed'],
      payout_status: ['draft', 'paid', 'cancelled'],
      product_origin: ['local', 'import', 'seller'],
      quote_status: ['open', 'used', 'expired', 'cancelled'],
      rate_source_kind: ['official', 'market_reference', 'manual'],
      risk_level: ['low', 'restricted', 'regulated'],
      shipping_kind: ['home_delivery', 'office_pickup', 'store_pickup'],
      store_kind: ['platform', 'seller'],
      store_member_role: ['owner', 'staff'],
      store_status: ['pending', 'active', 'suspended'],
      user_event_kind: ['view', 'search', 'favorite', 'add_to_cart', 'purchase', 'category_view', 'store_view'],
    },
  },
} as const;
