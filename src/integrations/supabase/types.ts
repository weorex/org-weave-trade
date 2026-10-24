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
          organization_id: string
          role_key: string
        }
        Insert: {
          display_name: string
          organization_id: string
          role_key: string
        }
        Update: {
          display_name?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_entity: {
        Args: { p_action: string; p_org: string; p_type: string }
        Returns: boolean
      }
      can_trade_entity: {
        Args: { p_entity: string; p_org: string; p_write?: boolean }
        Returns: boolean
      }
      has_org_role: {
        Args: { p_org_id: string; p_roles: string[] }
        Returns: boolean
      }
      import_trade_catalogue: {
        Args: { p_org: string; p_rows: Json; p_supplier: string }
        Returns: Json
      }
      is_org_member: { Args: { p_org_id: string }; Returns: boolean }
      publish_entity_configuration: {
        Args: {
          p_config: Json
          p_expected: number
          p_id: string
          p_org: string
        }
        Returns: Json
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
