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
      approval_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string
          entity_id: string
          from_status: string
          id: string
          organization_id: string
          reason: string
          requested_by: string
          status: string
          to_status: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string
          entity_id: string
          from_status: string
          id?: string
          organization_id: string
          reason?: string
          requested_by: string
          status?: string
          to_status: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string
          entity_id?: string
          from_status?: string
          id?: string
          organization_id?: string
          reason?: string
          requested_by?: string
          status?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_organization_id_entity_id_fkey"
            columns: ["organization_id", "entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          organization_id: string
          resource_id: string | null
          resource_type: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          organization_id: string
          resource_id?: string | null
          resource_type: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          resource_id?: string | null
          resource_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          email: string
          entity_id: string
          id: string
          name: string
          notes: string
          organization_id: string
          phone: string
          position: string
        }
        Insert: {
          created_at?: string
          email?: string
          entity_id: string
          id?: string
          name: string
          notes?: string
          organization_id: string
          phone?: string
          position?: string
        }
        Update: {
          created_at?: string
          email?: string
          entity_id?: string
          id?: string
          name?: string
          notes?: string
          organization_id?: string
          phone?: string
          position?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_organization_id_entity_id_fkey"
            columns: ["organization_id", "entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      data_captures: {
        Row: {
          created_at: string
          created_by: string
          entity_id: string
          id: string
          organization_id: string
          payload: Json
          request_id: string
          result: Json
          source_url: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          entity_id: string
          id?: string
          organization_id: string
          payload: Json
          request_id: string
          result: Json
          source_url: string
        }
        Update: {
          created_at?: string
          created_by?: string
          entity_id?: string
          id?: string
          organization_id?: string
          payload?: Json
          request_id?: string
          result?: Json
          source_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_captures_organization_id_entity_id_fkey"
            columns: ["organization_id", "entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "data_captures_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      entities: {
        Row: {
          configuration_version: number
          created_at: string
          created_by: string
          data: Json
          entity_type_id: string
          id: string
          organization_id: string
          revision: number
          updated_at: string
        }
        Insert: {
          configuration_version: number
          created_at?: string
          created_by?: string
          data?: Json
          entity_type_id: string
          id?: string
          organization_id: string
          revision?: number
          updated_at?: string
        }
        Update: {
          configuration_version?: number
          created_at?: string
          created_by?: string
          data?: Json
          entity_type_id?: string
          id?: string
          organization_id?: string
          revision?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entities_organization_id_entity_type_id_configuration_vers_fkey"
            columns: [
              "organization_id",
              "entity_type_id",
              "configuration_version",
            ]
            isOneToOne: false
            referencedRelation: "entity_types"
            referencedColumns: ["organization_id", "id", "version"]
          },
        ]
      }
      entity_field_definitions: {
        Row: {
          configuration_version: number
          entity_type_id: string
          field_key: string
          field_type: string
          label: string
          organization_id: string
          position: number
          required: boolean
          settings: Json
        }
        Insert: {
          configuration_version: number
          entity_type_id: string
          field_key: string
          field_type: string
          label: string
          organization_id: string
          position?: number
          required?: boolean
          settings?: Json
        }
        Update: {
          configuration_version?: number
          entity_type_id?: string
          field_key?: string
          field_type?: string
          label?: string
          organization_id?: string
          position?: number
          required?: boolean
          settings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "entity_field_definitions_organization_id_entity_type_id_co_fkey"
            columns: [
              "organization_id",
              "entity_type_id",
              "configuration_version",
            ]
            isOneToOne: false
            referencedRelation: "entity_types"
            referencedColumns: ["organization_id", "id", "version"]
          },
        ]
      }
      entity_products: {
        Row: {
          capacity: string
          created_at: string
          entity_id: string
          id: string
          lead_time_days: number | null
          moq: number
          organization_id: string
          packaging: string
          product_id: string
          supplier_sku: string
        }
        Insert: {
          capacity?: string
          created_at?: string
          entity_id: string
          id?: string
          lead_time_days?: number | null
          moq?: number
          organization_id: string
          packaging?: string
          product_id: string
          supplier_sku?: string
        }
        Update: {
          capacity?: string
          created_at?: string
          entity_id?: string
          id?: string
          lead_time_days?: number | null
          moq?: number
          organization_id?: string
          packaging?: string
          product_id?: string
          supplier_sku?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_products_organization_id_entity_id_fkey"
            columns: ["organization_id", "entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "entity_products_organization_id_product_id_fkey"
            columns: ["organization_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      entity_relationships: {
        Row: {
          created_at: string
          id: string
          notes: string
          organization_id: string
          relationship_type: string
          source_entity_id: string
          target_entity_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string
          organization_id: string
          relationship_type: string
          source_entity_id: string
          target_entity_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string
          organization_id?: string
          relationship_type?: string
          source_entity_id?: string
          target_entity_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_relationships_organization_id_source_entity_id_fkey"
            columns: ["organization_id", "source_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "entity_relationships_organization_id_target_entity_id_fkey"
            columns: ["organization_id", "target_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      entity_states: {
        Row: {
          assignee_user_id: string | null
          entity_id: string
          organization_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assignee_user_id?: string | null
          entity_id: string
          organization_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assignee_user_id?: string | null
          entity_id?: string
          organization_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entity_states_organization_id_entity_id_fkey"
            columns: ["organization_id", "entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      entity_type_layouts: {
        Row: {
          configuration_version: number
          entity_type_id: string
          layout: Json
          organization_id: string
        }
        Insert: {
          configuration_version: number
          entity_type_id: string
          layout: Json
          organization_id: string
        }
        Update: {
          configuration_version?: number
          entity_type_id?: string
          layout?: Json
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_type_layouts_organization_id_entity_type_id_configu_fkey"
            columns: [
              "organization_id",
              "entity_type_id",
              "configuration_version",
            ]
            isOneToOne: false
            referencedRelation: "entity_types"
            referencedColumns: ["organization_id", "id", "version"]
          },
        ]
      }
      entity_types: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          organization_id: string
          type_key: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          organization_id: string
          type_key: string
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          organization_id?: string
          type_key?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "entity_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      logistics_activity: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          id: string
          organization_id: string
          resource_id: string | null
          resource_type: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          id?: string
          organization_id: string
          resource_id?: string | null
          resource_type: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          id?: string
          organization_id?: string
          resource_id?: string | null
          resource_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "logistics_activity_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      logistics_documents: {
        Row: {
          created_at: string
          created_by: string
          entity_id: string
          id: string
          name: string
          object_path: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          entity_id: string
          id?: string
          name: string
          object_path: string
          organization_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          entity_id?: string
          id?: string
          name?: string
          object_path?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "logistics_documents_organization_id_entity_id_fkey"
            columns: ["organization_id", "entity_id"]
            isOneToOne: false
            referencedRelation: "logistics_profiles"
            referencedColumns: ["organization_id", "entity_id"]
          },
          {
            foreignKeyName: "logistics_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      logistics_profiles: {
        Row: {
          address: string
          country: string
          created_at: string
          email: string
          entity_id: string
          kind: string
          legal_name: string
          license_number: string
          notes: string
          organization_id: string
          phone: string
        }
        Insert: {
          address?: string
          country?: string
          created_at?: string
          email?: string
          entity_id: string
          kind: string
          legal_name: string
          license_number?: string
          notes?: string
          organization_id: string
          phone?: string
        }
        Update: {
          address?: string
          country?: string
          created_at?: string
          email?: string
          entity_id?: string
          kind?: string
          legal_name?: string
          license_number?: string
          notes?: string
          organization_id?: string
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "logistics_profiles_organization_id_entity_id_fkey"
            columns: ["organization_id", "entity_id"]
            isOneToOne: true
            referencedRelation: "entities"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "logistics_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          link_entity_id: string | null
          organization_id: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          link_entity_id?: string | null
          organization_id: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          link_entity_id?: string | null
          organization_id?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string
          expires_at: string
          id: string
          organization_id: string
          revoked_at: string | null
          role_key: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          organization_id: string
          revoked_at?: string | null
          role_key: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          organization_id?: string
          revoked_at?: string | null
          role_key?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_invitations_organization_id_role_key_fkey"
            columns: ["organization_id", "role_key"]
            isOneToOne: false
            referencedRelation: "organization_roles"
            referencedColumns: ["organization_id", "role_key"]
          },
        ]
      }
      organization_memberships: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role_key: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role_key?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role_key?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_memberships_organization_id_role_key_fkey"
            columns: ["organization_id", "role_key"]
            isOneToOne: false
            referencedRelation: "organization_roles"
            referencedColumns: ["organization_id", "role_key"]
          },
        ]
      }
      organization_roles: {
        Row: {
          display_name: string
          is_system: boolean
          organization_id: string
          role_key: string
        }
        Insert: {
          display_name: string
          is_system?: boolean
          organization_id: string
          role_key: string
        }
        Update: {
          display_name?: string
          is_system?: boolean
          organization_id?: string
          role_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          default_country: string | null
          default_currency: string
          id: string
          name: string
          owner_user_id: string
          postal_address: string
          slug: string
          status: string
          timezone: string
        }
        Insert: {
          created_at?: string
          default_country?: string | null
          default_currency?: string
          id?: string
          name: string
          owner_user_id: string
          postal_address?: string
          slug: string
          status?: string
          timezone?: string
        }
        Update: {
          created_at?: string
          default_country?: string | null
          default_currency?: string
          id?: string
          name?: string
          owner_user_id?: string
          postal_address?: string
          slug?: string
          status?: string
          timezone?: string
        }
        Relationships: []
      }
      ports: {
        Row: {
          city: string
          code: string
          country: string
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          city?: string
          code: string
          country: string
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          city?: string
          code?: string
          country?: string
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_prices: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          currency: string
          effective_date: string
          entity_product_id: string
          id: string
          min_quantity: number
          notes: string
          organization_id: string
          unit: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string
          currency: string
          effective_date: string
          entity_product_id: string
          id?: string
          min_quantity: number
          notes?: string
          organization_id: string
          unit: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          currency?: string
          effective_date?: string
          entity_product_id?: string
          id?: string
          min_quantity?: number
          notes?: string
          organization_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_prices_organization_id_entity_product_id_fkey"
            columns: ["organization_id", "entity_product_id"]
            isOneToOne: false
            referencedRelation: "entity_products"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          created_at: string
          created_by: string
          description: string
          id: string
          name: string
          organization_id: string
          sku: string
          status: string
          unit: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          name: string
          organization_id: string
          sku: string
          status?: string
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          name?: string
          organization_id?: string
          sku?: string
          status?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          preferences: Json
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id: string
          preferences?: Json
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          preferences?: Json
        }
        Relationships: []
      }
      rate_limit_counters: {
        Row: {
          action: string
          hits: number
          organization_id: string
          user_id: string
          window_start: string
        }
        Insert: {
          action: string
          hits?: number
          organization_id: string
          user_id: string
          window_start: string
        }
        Update: {
          action?: string
          hits?: number
          organization_id?: string
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          organization_id: string
          permission: string
          role_key: string
        }
        Insert: {
          organization_id: string
          permission: string
          role_key: string
        }
        Update: {
          organization_id?: string
          permission?: string
          role_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_organization_id_role_key_fkey"
            columns: ["organization_id", "role_key"]
            isOneToOne: false
            referencedRelation: "organization_roles"
            referencedColumns: ["organization_id", "role_key"]
          },
        ]
      }
      shipping_rates: {
        Row: {
          amount: number
          asset_id: string | null
          created_at: string
          created_by: string
          currency: string
          id: string
          min_quantity: number
          notes: string
          organization_id: string
          service_area_id: string | null
          shipping_route_id: string | null
          unit: string
          valid_from: string
          valid_until: string
        }
        Insert: {
          amount: number
          asset_id?: string | null
          created_at?: string
          created_by?: string
          currency: string
          id?: string
          min_quantity?: number
          notes?: string
          organization_id: string
          service_area_id?: string | null
          shipping_route_id?: string | null
          unit: string
          valid_from: string
          valid_until: string
        }
        Update: {
          amount?: number
          asset_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          min_quantity?: number
          notes?: string
          organization_id?: string
          service_area_id?: string | null
          shipping_route_id?: string | null
          unit?: string
          valid_from?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_rates_organization_id_asset_id_fkey"
            columns: ["organization_id", "asset_id"]
            isOneToOne: false
            referencedRelation: "transporter_assets"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "shipping_rates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_rates_organization_id_service_area_id_fkey"
            columns: ["organization_id", "service_area_id"]
            isOneToOne: false
            referencedRelation: "transporter_service_areas"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "shipping_rates_organization_id_shipping_route_id_fkey"
            columns: ["organization_id", "shipping_route_id"]
            isOneToOne: false
            referencedRelation: "shipping_routes"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      shipping_routes: {
        Row: {
          container_type: string
          created_at: string
          destination_port_id: string
          frequency: string
          id: string
          mode: string
          notes: string
          organization_id: string
          origin_port_id: string
          shipping_agent_entity_id: string
          transit_max_days: number
          transit_min_days: number
        }
        Insert: {
          container_type?: string
          created_at?: string
          destination_port_id: string
          frequency?: string
          id?: string
          mode: string
          notes?: string
          organization_id: string
          origin_port_id: string
          shipping_agent_entity_id: string
          transit_max_days: number
          transit_min_days: number
        }
        Update: {
          container_type?: string
          created_at?: string
          destination_port_id?: string
          frequency?: string
          id?: string
          mode?: string
          notes?: string
          organization_id?: string
          origin_port_id?: string
          shipping_agent_entity_id?: string
          transit_max_days?: number
          transit_min_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "shipping_routes_organization_id_destination_port_id_fkey"
            columns: ["organization_id", "destination_port_id"]
            isOneToOne: false
            referencedRelation: "ports"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "shipping_routes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_routes_organization_id_origin_port_id_fkey"
            columns: ["organization_id", "origin_port_id"]
            isOneToOne: false
            referencedRelation: "ports"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "shipping_routes_organization_id_shipping_agent_entity_id_fkey"
            columns: ["organization_id", "shipping_agent_entity_id"]
            isOneToOne: false
            referencedRelation: "logistics_profiles"
            referencedColumns: ["organization_id", "entity_id"]
          },
        ]
      }
      status_transitions: {
        Row: {
          created_at: string
          entity_type_id: string
          from_status: string
          id: string
          organization_id: string
          requires_approval: boolean
          to_status: string
        }
        Insert: {
          created_at?: string
          entity_type_id: string
          from_status: string
          id?: string
          organization_id: string
          requires_approval?: boolean
          to_status: string
        }
        Update: {
          created_at?: string
          entity_type_id?: string
          from_status?: string
          id?: string
          organization_id?: string
          requires_approval?: boolean
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_transitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transporter_assets: {
        Row: {
          capacity_cbm: number
          capacity_kg: number
          created_at: string
          id: string
          notes: string
          organization_id: string
          registration: string
          transporter_entity_id: string
          vehicle_type: string
        }
        Insert: {
          capacity_cbm: number
          capacity_kg: number
          created_at?: string
          id?: string
          notes?: string
          organization_id: string
          registration: string
          transporter_entity_id: string
          vehicle_type: string
        }
        Update: {
          capacity_cbm?: number
          capacity_kg?: number
          created_at?: string
          id?: string
          notes?: string
          organization_id?: string
          registration?: string
          transporter_entity_id?: string
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transporter_assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transporter_assets_organization_id_transporter_entity_id_fkey"
            columns: ["organization_id", "transporter_entity_id"]
            isOneToOne: false
            referencedRelation: "logistics_profiles"
            referencedColumns: ["organization_id", "entity_id"]
          },
        ]
      }
      transporter_service_areas: {
        Row: {
          country: string
          created_at: string
          delivery_zone: string
          id: string
          name: string
          notes: string
          organization_id: string
          pickup_zone: string
          transit_max_days: number
          transit_min_days: number
          transporter_entity_id: string
        }
        Insert: {
          country: string
          created_at?: string
          delivery_zone: string
          id?: string
          name: string
          notes?: string
          organization_id: string
          pickup_zone: string
          transit_max_days?: number
          transit_min_days?: number
          transporter_entity_id: string
        }
        Update: {
          country?: string
          created_at?: string
          delivery_zone?: string
          id?: string
          name?: string
          notes?: string
          organization_id?: string
          pickup_zone?: string
          transit_max_days?: number
          transit_min_days?: number
          transporter_entity_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transporter_service_areas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transporter_service_areas_organization_id_transporter_enti_fkey"
            columns: ["organization_id", "transporter_entity_id"]
            isOneToOne: false
            referencedRelation: "logistics_profiles"
            referencedColumns: ["organization_id", "entity_id"]
          },
        ]
      }
      workflow_run_logs: {
        Row: {
          action: string
          attempt: number
          created_at: string
          id: string
          message: string
          organization_id: string
          outcome: string
          run_id: string
          step_index: number
        }
        Insert: {
          action: string
          attempt: number
          created_at?: string
          id?: string
          message?: string
          organization_id: string
          outcome: string
          run_id: string
          step_index: number
        }
        Update: {
          action?: string
          attempt?: number
          created_at?: string
          id?: string
          message?: string
          organization_id?: string
          outcome?: string
          run_id?: string
          step_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "workflow_run_logs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_runs: {
        Row: {
          attempts: number
          created_at: string
          created_by: string
          definition: Json
          entity_id: string
          finished_at: string | null
          id: string
          last_error: string
          max_attempts: number
          organization_id: string
          request_id: string
          status: string
          workflow_id: string
          workflow_version: number
        }
        Insert: {
          attempts?: number
          created_at?: string
          created_by: string
          definition: Json
          entity_id: string
          finished_at?: string | null
          id?: string
          last_error?: string
          max_attempts?: number
          organization_id: string
          request_id: string
          status?: string
          workflow_id: string
          workflow_version: number
        }
        Update: {
          attempts?: number
          created_at?: string
          created_by?: string
          definition?: Json
          entity_id?: string
          finished_at?: string | null
          id?: string
          last_error?: string
          max_attempts?: number
          organization_id?: string
          request_id?: string
          status?: string
          workflow_id?: string
          workflow_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "workflow_runs_organization_id_entity_id_fkey"
            columns: ["organization_id", "entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "workflow_runs_organization_id_workflow_id_fkey"
            columns: ["organization_id", "workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      workflows: {
        Row: {
          active: boolean
          created_by: string
          definition: Json
          entity_type_id: string
          id: string
          name: string
          organization_id: string
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          created_by: string
          definition: Json
          entity_type_id: string
          id?: string
          name: string
          organization_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          created_by?: string
          definition?: Json
          entity_type_id?: string
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "workflows_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: string }
      apply_entity_status: {
        Args: { p_entity: string; p_org: string; p_to: string }
        Returns: undefined
      }
      can_entity: {
        Args: { p_action: string; p_org: string; p_type: string }
        Returns: boolean
      }
      can_logistics_object: {
        Args: { p_name: string; p_write?: boolean }
        Returns: boolean
      }
      can_logistics_rate: {
        Args: {
          p_area: string
          p_org: string
          p_route: string
          p_write?: boolean
        }
        Returns: boolean
      }
      can_trade_entity: {
        Args: { p_entity: string; p_org: string; p_write?: boolean }
        Returns: boolean
      }
      create_invitation: {
        Args: { p_hours: number; p_org: string; p_role: string }
        Returns: Json
      }
      decide_approval: {
        Args: {
          p_approve: boolean
          p_id: string
          p_note: string
          p_org: string
        }
        Returns: string
      }
      execute_workflow_run: { Args: { p_run: string }; Returns: Json }
      has_org_role: {
        Args: { p_org_id: string; p_roles: string[] }
        Returns: boolean
      }
      has_permission: {
        Args: { p_org: string; p_perm: string }
        Returns: boolean
      }
      hit_rate_limit: {
        Args: {
          p_action: string
          p_limit: number
          p_org: string
          p_window_seconds: number
        }
        Returns: undefined
      }
      import_trade_catalogue: {
        Args: { p_org: string; p_rows: Json; p_supplier: string }
        Returns: Json
      }
      is_org_member: { Args: { p_org_id: string }; Returns: boolean }
      mark_notifications_read: {
        Args: { p_ids: string[]; p_org: string }
        Returns: number
      }
      notify_user: {
        Args: {
          p_body: string
          p_entity: string
          p_org: string
          p_title: string
          p_user: string
        }
        Returns: undefined
      }
      publish_entity_configuration: {
        Args: {
          p_config: Json
          p_expected: number
          p_id: string
          p_org: string
        }
        Returns: Json
      }
      request_entity_status: {
        Args: {
          p_entity: string
          p_force_approval: boolean
          p_org: string
          p_reason: string
          p_to: string
        }
        Returns: string
      }
      retry_workflow_run: {
        Args: { p_org: string; p_run: string }
        Returns: Json
      }
      revoke_invitation: {
        Args: { p_id: string; p_org: string }
        Returns: undefined
      }
      run_workflow: {
        Args: {
          p_entity: string
          p_org: string
          p_request: string
          p_workflow: string
        }
        Returns: Json
      }
      save_custom_role: {
        Args: {
          p_key: string
          p_name: string
          p_org: string
          p_permissions: string[]
        }
        Returns: undefined
      }
      save_data_capture: {
        Args: {
          p_contacts: Json
          p_org: string
          p_products: Json
          p_request: string
          p_source: string
          p_type: string
          p_values: Json
          p_version: number
        }
        Returns: Json
      }
      save_status_transition: {
        Args: {
          p_from: string
          p_org: string
          p_requires_approval: boolean
          p_to: string
          p_type: string
        }
        Returns: undefined
      }
      save_workflow: {
        Args: {
          p_active: boolean
          p_definition: Json
          p_id: string
          p_name: string
          p_org: string
          p_type: string
        }
        Returns: string
      }
      transition_entity: {
        Args: {
          p_entity: string
          p_org: string
          p_reason: string
          p_to: string
        }
        Returns: string
      }
      update_member: {
        Args: {
          p_membership: string
          p_org: string
          p_role: string
          p_status: string
        }
        Returns: undefined
      }
      validate_workflow_definition: {
        Args: { p_def: Json; p_org: string }
        Returns: undefined
      }
      write_audit: {
        Args: { p_action: string; p_id: string; p_org: string; p_type: string }
        Returns: undefined
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
    Enums: {},
  },
} as const
