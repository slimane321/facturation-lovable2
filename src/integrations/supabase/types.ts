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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      achat_lines: {
        Row: {
          achat_id: string
          description: string
          id: string
          product_id: string | null
          quantity: number
          sort_order: number
          unit_price: number
          vat_rate: number
        }
        Insert: {
          achat_id: string
          description: string
          id?: string
          product_id?: string | null
          quantity?: number
          sort_order?: number
          unit_price?: number
          vat_rate?: number
        }
        Update: {
          achat_id?: string
          description?: string
          id?: string
          product_id?: string | null
          quantity?: number
          sort_order?: number
          unit_price?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "achat_lines_achat_id_fkey"
            columns: ["achat_id"]
            isOneToOne: false
            referencedRelation: "achats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achat_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      achats: {
        Row: {
          achat_date: string
          created_at: string
          id: string
          number: string
          payment_method: string | null
          payment_ref: string | null
          status: Database["public"]["Enums"]["achat_status"]
          subtotal_ht: number
          supplier_ice: string | null
          supplier_if: string | null
          supplier_name: string
          total_ttc: number
          total_tva: number
          updated_at: string
        }
        Insert: {
          achat_date?: string
          created_at?: string
          id?: string
          number: string
          payment_method?: string | null
          payment_ref?: string | null
          status?: Database["public"]["Enums"]["achat_status"]
          subtotal_ht?: number
          supplier_ice?: string | null
          supplier_if?: string | null
          supplier_name: string
          total_ttc?: number
          total_tva?: number
          updated_at?: string
        }
        Update: {
          achat_date?: string
          created_at?: string
          id?: string
          number?: string
          payment_method?: string | null
          payment_ref?: string | null
          status?: Database["public"]["Enums"]["achat_status"]
          subtotal_ht?: number
          supplier_ice?: string | null
          supplier_if?: string | null
          supplier_name?: string
          total_ttc?: number
          total_tva?: number
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: string | null
          document_id: string | null
          document_number: string | null
          document_type: string
          id: string
          new_value: Json | null
          old_value: Json | null
          user_name: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          document_id?: string | null
          document_number?: string | null
          document_type: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          user_name?: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          document_id?: string | null
          document_number?: string | null
          document_type?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          user_name?: string
        }
        Relationships: []
      }
      bc_lines: {
        Row: {
          bc_id: string
          description: string
          id: string
          product_id: string | null
          quantity: number
          sort_order: number
          unit_price: number
          vat_rate: number
        }
        Insert: {
          bc_id: string
          description: string
          id?: string
          product_id?: string | null
          quantity?: number
          sort_order?: number
          unit_price?: number
          vat_rate?: number
        }
        Update: {
          bc_id?: string
          description?: string
          id?: string
          product_id?: string | null
          quantity?: number
          sort_order?: number
          unit_price?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "bc_lines_bc_id_fkey"
            columns: ["bc_id"]
            isOneToOne: false
            referencedRelation: "bon_commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bc_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      bl_lines: {
        Row: {
          bl_id: string
          description: string
          id: string
          product_id: string | null
          quantity: number
          sort_order: number
          unit_price: number
          vat_rate: number
        }
        Insert: {
          bl_id: string
          description: string
          id?: string
          product_id?: string | null
          quantity?: number
          sort_order?: number
          unit_price?: number
          vat_rate?: number
        }
        Update: {
          bl_id?: string
          description?: string
          id?: string
          product_id?: string | null
          quantity?: number
          sort_order?: number
          unit_price?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "bl_lines_bl_id_fkey"
            columns: ["bl_id"]
            isOneToOne: false
            referencedRelation: "bon_livraison"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bl_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      bon_commande: {
        Row: {
          bc_date: string
          client_id: string
          converted_bl_id: string | null
          created_at: string
          id: string
          is_converted: boolean
          notes: string | null
          number: string
          payment_method: string | null
          source_devis_id: string | null
          status: Database["public"]["Enums"]["bc_status"]
          subtotal_ht: number
          total_ttc: number
          total_tva: number
          updated_at: string
        }
        Insert: {
          bc_date?: string
          client_id: string
          converted_bl_id?: string | null
          created_at?: string
          id?: string
          is_converted?: boolean
          notes?: string | null
          number: string
          payment_method?: string | null
          source_devis_id?: string | null
          status?: Database["public"]["Enums"]["bc_status"]
          subtotal_ht?: number
          total_ttc?: number
          total_tva?: number
          updated_at?: string
        }
        Update: {
          bc_date?: string
          client_id?: string
          converted_bl_id?: string | null
          created_at?: string
          id?: string
          is_converted?: boolean
          notes?: string | null
          number?: string
          payment_method?: string | null
          source_devis_id?: string | null
          status?: Database["public"]["Enums"]["bc_status"]
          subtotal_ht?: number
          total_ttc?: number
          total_tva?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bon_commande_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bon_commande_source_devis_id_fkey"
            columns: ["source_devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
        ]
      }
      bon_livraison: {
        Row: {
          bl_date: string
          client_id: string
          created_at: string
          id: string
          is_converted: boolean
          linked_invoice_id: string | null
          notes: string | null
          number: string
          source_bc_id: string | null
          source_invoice_id: string | null
          status: Database["public"]["Enums"]["bl_status"]
          subtotal_ht: number
          total_ttc: number
          total_tva: number
          updated_at: string
        }
        Insert: {
          bl_date?: string
          client_id: string
          created_at?: string
          id?: string
          is_converted?: boolean
          linked_invoice_id?: string | null
          notes?: string | null
          number: string
          source_bc_id?: string | null
          source_invoice_id?: string | null
          status?: Database["public"]["Enums"]["bl_status"]
          subtotal_ht?: number
          total_ttc?: number
          total_tva?: number
          updated_at?: string
        }
        Update: {
          bl_date?: string
          client_id?: string
          created_at?: string
          id?: string
          is_converted?: boolean
          linked_invoice_id?: string | null
          notes?: string | null
          number?: string
          source_bc_id?: string | null
          source_invoice_id?: string | null
          status?: Database["public"]["Enums"]["bl_status"]
          subtotal_ht?: number
          total_ttc?: number
          total_tva?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bon_livraison_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bon_livraison_linked_invoice_id_fkey"
            columns: ["linked_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bon_livraison_source_bc_id_fkey"
            columns: ["source_bc_id"]
            isOneToOne: false
            referencedRelation: "bon_commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bon_livraison_source_invoice_id_fkey"
            columns: ["source_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string
          business_name: string
          city: string
          client_type: Database["public"]["Enums"]["client_type"]
          created_at: string
          email: string | null
          ice: string | null
          id: string
          if_number: string | null
          phone: string | null
          rc: string | null
          updated_at: string
        }
        Insert: {
          address?: string
          business_name: string
          city?: string
          client_type?: Database["public"]["Enums"]["client_type"]
          created_at?: string
          email?: string | null
          ice?: string | null
          id?: string
          if_number?: string | null
          phone?: string | null
          rc?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          business_name?: string
          city?: string
          client_type?: Database["public"]["Enums"]["client_type"]
          created_at?: string
          email?: string | null
          ice?: string | null
          id?: string
          if_number?: string | null
          phone?: string | null
          rc?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      closed_fiscal_years: {
        Row: {
          closed_at: string
          id: string
          master_hash: string | null
          year: number
        }
        Insert: {
          closed_at?: string
          id?: string
          master_hash?: string | null
          year: number
        }
        Update: {
          closed_at?: string
          id?: string
          master_hash?: string | null
          year?: number
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          address: string
          bank: string
          capital_social: string | null
          city: string
          cnss: string
          created_at: string
          email: string
          ice: string
          id: string
          if_number: string
          logo_url: string | null
          name: string
          patente: string
          rc: string
          rib: string
          tel: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string
          bank?: string
          capital_social?: string | null
          city?: string
          cnss?: string
          created_at?: string
          email?: string
          ice?: string
          id?: string
          if_number?: string
          logo_url?: string | null
          name?: string
          patente?: string
          rc?: string
          rib?: string
          tel?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string
          bank?: string
          capital_social?: string | null
          city?: string
          cnss?: string
          created_at?: string
          email?: string
          ice?: string
          id?: string
          if_number?: string
          logo_url?: string | null
          name?: string
          patente?: string
          rc?: string
          rib?: string
          tel?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      devis: {
        Row: {
          client_id: string
          converted_bc_id: string | null
          created_at: string
          devis_date: string
          id: string
          is_converted: boolean
          notes: string | null
          number: string
          payment_method: string | null
          status: Database["public"]["Enums"]["devis_status"]
          subtotal_ht: number
          total_ttc: number
          total_tva: number
          updated_at: string
          validity_date: string | null
        }
        Insert: {
          client_id: string
          converted_bc_id?: string | null
          created_at?: string
          devis_date?: string
          id?: string
          is_converted?: boolean
          notes?: string | null
          number: string
          payment_method?: string | null
          status?: Database["public"]["Enums"]["devis_status"]
          subtotal_ht?: number
          total_ttc?: number
          total_tva?: number
          updated_at?: string
          validity_date?: string | null
        }
        Update: {
          client_id?: string
          converted_bc_id?: string | null
          created_at?: string
          devis_date?: string
          id?: string
          is_converted?: boolean
          notes?: string | null
          number?: string
          payment_method?: string | null
          status?: Database["public"]["Enums"]["devis_status"]
          subtotal_ht?: number
          total_ttc?: number
          total_tva?: number
          updated_at?: string
          validity_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devis_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      devis_lines: {
        Row: {
          description: string
          devis_id: string
          id: string
          product_id: string | null
          quantity: number
          sort_order: number
          unit_price: number
          vat_rate: number
        }
        Insert: {
          description: string
          devis_id: string
          id?: string
          product_id?: string | null
          quantity?: number
          sort_order?: number
          unit_price?: number
          vat_rate?: number
        }
        Update: {
          description?: string
          devis_id?: string
          id?: string
          product_id?: string | null
          quantity?: number
          sort_order?: number
          unit_price?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "devis_lines_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devis_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          expense_date: string
          id: string
          payment_method: string | null
          reference: string | null
          tva_amount: number
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          payment_method?: string | null
          reference?: string | null
          tva_amount?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          payment_method?: string | null
          reference?: string | null
          tva_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      invoice_lines: {
        Row: {
          description: string
          id: string
          invoice_id: string
          product_id: string | null
          quantity: number
          sort_order: number
          unit_price: number
          vat_rate: number
        }
        Insert: {
          description: string
          id?: string
          invoice_id: string
          product_id?: string | null
          quantity?: number
          sort_order?: number
          unit_price?: number
          vat_rate?: number
        }
        Update: {
          description?: string
          id?: string
          invoice_id?: string
          product_id?: string | null
          quantity?: number
          sort_order?: number
          unit_price?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          avoir_id: string | null
          bl_id: string | null
          client_id: string
          created_at: string
          dgi_registration_number: string | null
          dgi_status: string | null
          due_date: string
          has_avoir: boolean
          hash: string | null
          id: string
          invoice_date: string
          notes: string | null
          number: string
          original_invoice_id: string | null
          payment_method: string | null
          payment_ref: string | null
          previous_hash: string | null
          signature: string | null
          signed_pdf_url: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal_ht: number
          timbre: number
          total_paid: number
          total_ttc: number
          total_tva: number
          updated_at: string
        }
        Insert: {
          avoir_id?: string | null
          bl_id?: string | null
          client_id: string
          created_at?: string
          dgi_registration_number?: string | null
          dgi_status?: string | null
          due_date?: string
          has_avoir?: boolean
          hash?: string | null
          id?: string
          invoice_date?: string
          notes?: string | null
          number?: string
          original_invoice_id?: string | null
          payment_method?: string | null
          payment_ref?: string | null
          previous_hash?: string | null
          signature?: string | null
          signed_pdf_url?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_ht?: number
          timbre?: number
          total_paid?: number
          total_ttc?: number
          total_tva?: number
          updated_at?: string
        }
        Update: {
          avoir_id?: string | null
          bl_id?: string | null
          client_id?: string
          created_at?: string
          dgi_registration_number?: string | null
          dgi_status?: string | null
          due_date?: string
          has_avoir?: boolean
          hash?: string | null
          id?: string
          invoice_date?: string
          notes?: string | null
          number?: string
          original_invoice_id?: string | null
          payment_method?: string | null
          payment_ref?: string | null
          previous_hash?: string | null
          signature?: string | null
          signed_pdf_url?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_ht?: number
          timbre?: number
          total_paid?: number
          total_ttc?: number
          total_tva?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_invoices_bl"
            columns: ["bl_id"]
            isOneToOne: false
            referencedRelation: "bon_livraison"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_avoir_id_fkey"
            columns: ["avoir_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_original_invoice_id_fkey"
            columns: ["original_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          category: string
          created_at: string
          href: string | null
          icon: string | null
          id: string
          message: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          href?: string | null
          icon?: string | null
          id?: string
          message: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          href?: string | null
          icon?: string | null
          id?: string
          message?: string
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          method: string
          payment_date: string
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          method: string
          payment_date?: string
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          method?: string
          payment_date?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          description: string | null
          id: string
          min_stock_threshold: number
          name: string
          reference: string
          stock: number
          unit: string | null
          unit_price: number
          updated_at: string
          vat_rate: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          min_stock_threshold?: number
          name: string
          reference: string
          stock?: number
          unit?: string | null
          unit_price?: number
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          min_stock_threshold?: number
          name?: string
          reference?: string
          stock?: number
          unit?: string | null
          unit_price?: number
          updated_at?: string
          vat_rate?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          email: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          email?: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          document_ref: string | null
          id: string
          movement_date: string
          new_balance: number
          product_id: string
          quantity: number
          type: Database["public"]["Enums"]["movement_type"]
        }
        Insert: {
          created_at?: string
          document_ref?: string | null
          id?: string
          movement_date?: string
          new_balance: number
          product_id: string
          quantity: number
          type: Database["public"]["Enums"]["movement_type"]
        }
        Update: {
          created_at?: string
          document_ref?: string | null
          id?: string
          movement_date?: string
          new_balance?: number
          product_id?: string
          quantity?: number
          type?: Database["public"]["Enums"]["movement_type"]
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      achat_status: "draft" | "validated" | "paid" | "cancelled"
      app_role: "admin" | "agent" | "comptable"
      bc_status: "draft" | "confirmed" | "converted" | "cancelled"
      bl_status: "draft" | "delivered" | "converted" | "cancelled"
      client_type: "company" | "individual"
      devis_status:
        | "draft"
        | "sent"
        | "accepted"
        | "rejected"
        | "expired"
        | "converted"
      invoice_status:
        | "draft"
        | "pending"
        | "validated"
        | "paid"
        | "cancelled"
        | "avoir"
      movement_type: "sale" | "purchase" | "return" | "manual"
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
      achat_status: ["draft", "validated", "paid", "cancelled"],
      app_role: ["admin", "agent", "comptable"],
      bc_status: ["draft", "confirmed", "converted", "cancelled"],
      bl_status: ["draft", "delivered", "converted", "cancelled"],
      client_type: ["company", "individual"],
      devis_status: [
        "draft",
        "sent",
        "accepted",
        "rejected",
        "expired",
        "converted",
      ],
      invoice_status: [
        "draft",
        "pending",
        "validated",
        "paid",
        "cancelled",
        "avoir",
      ],
      movement_type: ["sale", "purchase", "return", "manual"],
    },
  },
} as const
