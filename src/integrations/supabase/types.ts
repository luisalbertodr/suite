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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      agenda_appointments: {
        Row: {
          appointment_date: string
          client_name: string
          color: string
          company_id: string | null
          created_at: string
          description: string | null
          employee_id: string
          end_time: string
          id: string
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          appointment_date: string
          client_name: string
          color: string
          company_id?: string | null
          created_at?: string
          description?: string | null
          employee_id: string
          end_time: string
          id?: string
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          appointment_date?: string
          client_name?: string
          color?: string
          company_id?: string | null
          created_at?: string
          description?: string | null
          employee_id?: string
          end_time?: string
          id?: string
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_appointments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_employees: {
        Row: {
          color: string
          company_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          color: string
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      article_families: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      article_variations: {
        Row: {
          article_id: string
          codigo_barras: string | null
          color: string
          created_at: string
          estado: string
          id: string
          iva_percentage: number | null
          precio: number
          precio_compra: number
          stock_actual: number
          stock_minimo: number
          talla: string
          updated_at: string
        }
        Insert: {
          article_id: string
          codigo_barras?: string | null
          color: string
          created_at?: string
          estado?: string
          id?: string
          iva_percentage?: number | null
          precio?: number
          precio_compra?: number
          stock_actual?: number
          stock_minimo?: number
          talla: string
          updated_at?: string
        }
        Update: {
          article_id?: string
          codigo_barras?: string | null
          color?: string
          created_at?: string
          estado?: string
          id?: string
          iva_percentage?: number | null
          precio?: number
          precio_compra?: number
          stock_actual?: number
          stock_minimo?: number
          talla?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_variations_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          codigo: string
          codigo_barras: string | null
          codigo_serie: string | null
          company_id: string | null
          created_at: string
          descripcion: string
          descripcion_larga: string | null
          estado: string
          familia: string
          foto_url: string | null
          id: string
          iva_percentage: number | null
          precio: number
          precio_compra: number
          stock_actual: number
          stock_minimo: number
          tipo_producto: string
          updated_at: string
        }
        Insert: {
          codigo: string
          codigo_barras?: string | null
          codigo_serie?: string | null
          company_id?: string | null
          created_at?: string
          descripcion: string
          descripcion_larga?: string | null
          estado?: string
          familia: string
          foto_url?: string | null
          id?: string
          iva_percentage?: number | null
          precio?: number
          precio_compra?: number
          stock_actual?: number
          stock_minimo?: number
          tipo_producto?: string
          updated_at?: string
        }
        Update: {
          codigo?: string
          codigo_barras?: string | null
          codigo_serie?: string | null
          company_id?: string | null
          created_at?: string
          descripcion?: string
          descripcion_larga?: string | null
          estado?: string
          familia?: string
          foto_url?: string | null
          id?: string
          iva_percentage?: number | null
          precio?: number
          precio_compra?: number
          stock_actual?: number
          stock_minimo?: number
          tipo_producto?: string
          updated_at?: string
        }
        Relationships: []
      }
      colors: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          additional_info: string | null
          address_city: string | null
          address_country: string | null
          address_postal_code: string | null
          address_state: string | null
          address_street: string | null
          created_at: string
          email: string
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          tax_id: string
          updated_at: string
          website: string | null
        }
        Insert: {
          additional_info?: string | null
          address_city?: string | null
          address_country?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          address_street?: string | null
          created_at?: string
          email: string
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          tax_id: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          additional_info?: string | null
          address_city?: string | null
          address_country?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          address_street?: string | null
          created_at?: string
          email?: string
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          tax_id?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      customer_contacts: {
        Row: {
          contact_email: string | null
          contact_name: string
          contact_phone: string | null
          created_at: string
          customer_id: string
          id: string
          is_primary: boolean | null
          observations: string | null
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          customer_id: string
          id?: string
          is_primary?: boolean | null
          observations?: string | null
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          is_primary?: boolean | null
          observations?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_shipping_addresses: {
        Row: {
          address_city: string | null
          address_country: string | null
          address_name: string
          address_postal_code: string | null
          address_state: string | null
          address_street: string | null
          created_at: string
          customer_id: string
          id: string
          is_default: boolean | null
          updated_at: string
        }
        Insert: {
          address_city?: string | null
          address_country?: string | null
          address_name: string
          address_postal_code?: string | null
          address_state?: string | null
          address_street?: string | null
          created_at?: string
          customer_id: string
          id?: string
          is_default?: boolean | null
          updated_at?: string
        }
        Update: {
          address_city?: string | null
          address_country?: string | null
          address_name?: string
          address_postal_code?: string | null
          address_state?: string | null
          address_street?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          is_default?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_shipping_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address_city: string | null
          address_country: string | null
          address_postal_code: string | null
          address_state: string | null
          address_street: string | null
          company_id: string | null
          contact_person: string | null
          created_at: string
          credit_limit: number | null
          email: string | null
          iban_account: string | null
          id: string
          intracomunitario: string | null
          irpf_percentage: number | null
          name: string
          notes: string | null
          payment_terms: number | null
          phone: string | null
          photo_url: string | null
          re_percentage: number | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address_city?: string | null
          address_country?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          address_street?: string | null
          company_id?: string | null
          contact_person?: string | null
          created_at?: string
          credit_limit?: number | null
          email?: string | null
          iban_account?: string | null
          id?: string
          intracomunitario?: string | null
          irpf_percentage?: number | null
          name: string
          notes?: string | null
          payment_terms?: number | null
          phone?: string | null
          photo_url?: string | null
          re_percentage?: number | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address_city?: string | null
          address_country?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          address_street?: string | null
          company_id?: string | null
          contact_person?: string | null
          created_at?: string
          credit_limit?: number | null
          email?: string | null
          iban_account?: string | null
          id?: string
          intracomunitario?: string | null
          irpf_percentage?: number | null
          name?: string
          notes?: string | null
          payment_terms?: number | null
          phone?: string | null
          photo_url?: string | null
          re_percentage?: number | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_note_items: {
        Row: {
          article_id: string | null
          created_at: string
          delivery_note_id: string
          description: string
          id: string
          quantity: number
          total_price: number
          unit_price: number
          variation_id: string | null
        }
        Insert: {
          article_id?: string | null
          created_at?: string
          delivery_note_id: string
          description: string
          id?: string
          quantity?: number
          total_price?: number
          unit_price?: number
          variation_id?: string | null
        }
        Update: {
          article_id?: string | null
          created_at?: string
          delivery_note_id?: string
          description?: string
          id?: string
          quantity?: number
          total_price?: number
          unit_price?: number
          variation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_note_items_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_items_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "delivery_note_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_delivery_note_items_delivery_note_id"
            columns: ["delivery_note_id"]
            isOneToOne: false
            referencedRelation: "delivery_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_notes: {
        Row: {
          company_id: string | null
          created_at: string
          customer_id: string | null
          delivery_date: string | null
          id: string
          issue_date: string
          notes: string | null
          number: string
          status: string
          subtotal: number
          supplier_id: string | null
          tax_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          customer_id?: string | null
          delivery_date?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          number: string
          status?: string
          subtotal?: number
          supplier_id?: string | null
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          customer_id?: string | null
          delivery_date?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          number?: string
          status?: string
          subtotal?: number
          supplier_id?: string | null
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      document_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          category: string
          company_id: string | null
          created_at: string
          file_path: string
          file_size: number
          id: string
          mime_type: string
          name: string
          original_name: string
          tags: string[] | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string
          company_id?: string | null
          created_at?: string
          file_path: string
          file_size: number
          id?: string
          mime_type: string
          name: string
          original_name: string
          tags?: string[] | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string
          company_id?: string | null
          created_at?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          name?: string
          original_name?: string
          tags?: string[] | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          brand: string | null
          category: string
          code: string
          company_id: string | null
          created_at: string
          current_stock: number
          description: string | null
          id: string
          location: string | null
          minimum_stock: number
          model: string | null
          name: string
          photos: string[] | null
          supplier: string | null
          unit: string
          unit_cost: number | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          brand?: string | null
          category: string
          code: string
          company_id?: string | null
          created_at?: string
          current_stock?: number
          description?: string | null
          id?: string
          location?: string | null
          minimum_stock?: number
          model?: string | null
          name: string
          photos?: string[] | null
          supplier?: string | null
          unit?: string
          unit_cost?: number | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          brand?: string | null
          category?: string
          code?: string
          company_id?: string | null
          created_at?: string
          current_stock?: number
          description?: string | null
          id?: string
          location?: string | null
          minimum_stock?: number
          model?: string | null
          name?: string
          photos?: string[] | null
          supplier?: string | null
          unit?: string
          unit_cost?: number | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          item_id: string
          notes: string | null
          quantity: number
          reference: string | null
          type: string
          unit_cost: number | null
          work_order_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id: string
          notes?: string | null
          quantity: number
          reference?: string | null
          type: string
          unit_cost?: number | null
          work_order_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string
          notes?: string | null
          quantity?: number
          reference?: string | null
          type?: string
          unit_cost?: number | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string
          discount_percentage: number | null
          id: string
          invoice_id: string
          iva_amount: number | null
          iva_percentage: number | null
          quantity: number
          re_amount: number | null
          re_percentage: number | null
          subtotal_after_discount: number | null
          total_price: number
          unit_price: number
          variation_id: string | null
        }
        Insert: {
          created_at?: string
          description: string
          discount_percentage?: number | null
          id?: string
          invoice_id: string
          iva_amount?: number | null
          iva_percentage?: number | null
          quantity?: number
          re_amount?: number | null
          re_percentage?: number | null
          subtotal_after_discount?: number | null
          total_price: number
          unit_price: number
          variation_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          discount_percentage?: number | null
          id?: string
          invoice_id?: string
          iva_amount?: number | null
          iva_percentage?: number | null
          quantity?: number
          re_amount?: number | null
          re_percentage?: number | null
          subtotal_after_discount?: number | null
          total_price?: number
          unit_price?: number
          variation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "article_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          clave_regimen_especial: string | null
          company_id: string | null
          corrective_reason: string | null
          created_at: string
          currency: string
          customer_id: string
          descripcion_operacion: string | null
          due_date: string
          fecha_operacion: string | null
          id: string
          is_corrective: boolean | null
          is_intracomunitario: boolean | null
          issue_date: string
          notes: string | null
          number: string
          original_invoice_id: string | null
          paid_date: string | null
          paid_status: boolean
          re_total: number | null
          status: string
          subtotal: number
          tax_amount: number
          tipo_factura: string | null
          total_amount: number
          updated_at: string
          verifactu_chain_data: Json | null
          verifactu_csv: string | null
          verifactu_fecha_hora_huella: string | null
          verifactu_huella: string | null
          verifactu_numero_registro: string | null
          verifactu_qr_code: string | null
          verifactu_response_code: string | null
          verifactu_response_message: string | null
          verifactu_sent_at: string | null
          verifactu_status: string | null
          verifactu_version: string | null
          work_order_id: string | null
        }
        Insert: {
          clave_regimen_especial?: string | null
          company_id?: string | null
          corrective_reason?: string | null
          created_at?: string
          currency?: string
          customer_id: string
          descripcion_operacion?: string | null
          due_date: string
          fecha_operacion?: string | null
          id?: string
          is_corrective?: boolean | null
          is_intracomunitario?: boolean | null
          issue_date?: string
          notes?: string | null
          number: string
          original_invoice_id?: string | null
          paid_date?: string | null
          paid_status?: boolean
          re_total?: number | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tipo_factura?: string | null
          total_amount?: number
          updated_at?: string
          verifactu_chain_data?: Json | null
          verifactu_csv?: string | null
          verifactu_fecha_hora_huella?: string | null
          verifactu_huella?: string | null
          verifactu_numero_registro?: string | null
          verifactu_qr_code?: string | null
          verifactu_response_code?: string | null
          verifactu_response_message?: string | null
          verifactu_sent_at?: string | null
          verifactu_status?: string | null
          verifactu_version?: string | null
          work_order_id?: string | null
        }
        Update: {
          clave_regimen_especial?: string | null
          company_id?: string | null
          corrective_reason?: string | null
          created_at?: string
          currency?: string
          customer_id?: string
          descripcion_operacion?: string | null
          due_date?: string
          fecha_operacion?: string | null
          id?: string
          is_corrective?: boolean | null
          is_intracomunitario?: boolean | null
          issue_date?: string
          notes?: string | null
          number?: string
          original_invoice_id?: string | null
          paid_date?: string | null
          paid_status?: boolean
          re_total?: number | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tipo_factura?: string | null
          total_amount?: number
          updated_at?: string
          verifactu_chain_data?: Json | null
          verifactu_csv?: string | null
          verifactu_fecha_hora_huella?: string | null
          verifactu_huella?: string | null
          verifactu_numero_registro?: string | null
          verifactu_qr_code?: string | null
          verifactu_response_code?: string | null
          verifactu_response_message?: string | null
          verifactu_sent_at?: string | null
          verifactu_status?: string | null
          verifactu_version?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_original_invoice_id_fkey"
            columns: ["original_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_schedules: {
        Row: {
          created_at: string
          description: string | null
          frequency_type: string
          frequency_value: number
          id: string
          is_active: boolean
          last_service_date: string | null
          last_service_reading: number | null
          next_service_date: string | null
          next_service_reading: number | null
          title: string
          type: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          frequency_type: string
          frequency_value: number
          id?: string
          is_active?: boolean
          last_service_date?: string | null
          last_service_reading?: number | null
          next_service_date?: string | null
          next_service_reading?: number | null
          title: string
          type: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          frequency_type?: string
          frequency_value?: number
          id?: string
          is_active?: boolean
          last_service_date?: string | null
          last_service_reading?: number | null
          next_service_date?: string | null
          next_service_reading?: number | null
          title?: string
          type?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_schedules_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          created_at: string
          description: string | null
          id: string
          name: string
          resource: string
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          resource: string
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          resource?: string
        }
        Relationships: []
      }
      planilla_items: {
        Row: {
          articulo: string
          color: string
          created_at: string
          descripcion: string | null
          id: string
          planilla_id: string
          precio: number
          talla_16: number | null
          talla_17: number | null
          talla_18: number | null
          talla_19: number | null
          talla_20: number | null
          talla_21: number | null
          talla_22: number | null
          talla_23: number | null
          talla_24: number | null
          talla_25: number | null
          talla_26: number | null
          talla_27: number | null
          talla_28: number | null
          talla_29: number | null
          talla_30: number | null
          talla_31: number | null
          talla_32: number | null
          talla_33: number | null
          talla_34: number | null
          talla_35: number | null
          talla_36: number | null
          talla_37: number | null
          talla_38: number | null
          talla_39: number | null
          talla_40: number | null
          talla_41: number | null
          talla_42: number | null
          talla_43: number | null
          talla_44: number | null
          talla_45: number | null
          talla_46: number | null
          updated_at: string
        }
        Insert: {
          articulo: string
          color: string
          created_at?: string
          descripcion?: string | null
          id?: string
          planilla_id: string
          precio: number
          talla_16?: number | null
          talla_17?: number | null
          talla_18?: number | null
          talla_19?: number | null
          talla_20?: number | null
          talla_21?: number | null
          talla_22?: number | null
          talla_23?: number | null
          talla_24?: number | null
          talla_25?: number | null
          talla_26?: number | null
          talla_27?: number | null
          talla_28?: number | null
          talla_29?: number | null
          talla_30?: number | null
          talla_31?: number | null
          talla_32?: number | null
          talla_33?: number | null
          talla_34?: number | null
          talla_35?: number | null
          talla_36?: number | null
          talla_37?: number | null
          talla_38?: number | null
          talla_39?: number | null
          talla_40?: number | null
          talla_41?: number | null
          talla_42?: number | null
          talla_43?: number | null
          talla_44?: number | null
          talla_45?: number | null
          talla_46?: number | null
          updated_at?: string
        }
        Update: {
          articulo?: string
          color?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          planilla_id?: string
          precio?: number
          talla_16?: number | null
          talla_17?: number | null
          talla_18?: number | null
          talla_19?: number | null
          talla_20?: number | null
          talla_21?: number | null
          talla_22?: number | null
          talla_23?: number | null
          talla_24?: number | null
          talla_25?: number | null
          talla_26?: number | null
          talla_27?: number | null
          talla_28?: number | null
          talla_29?: number | null
          talla_30?: number | null
          talla_31?: number | null
          talla_32?: number | null
          talla_33?: number | null
          talla_34?: number | null
          talla_35?: number | null
          talla_36?: number | null
          talla_37?: number | null
          talla_38?: number | null
          talla_39?: number | null
          talla_40?: number | null
          talla_41?: number | null
          talla_42?: number | null
          talla_43?: number | null
          talla_44?: number | null
          talla_45?: number | null
          talla_46?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planilla_items_planilla_id_fkey"
            columns: ["planilla_id"]
            isOneToOne: false
            referencedRelation: "planillas"
            referencedColumns: ["id"]
          },
        ]
      }
      planillas: {
        Row: {
          codigo: string
          company_id: string
          created_at: string
          estado: string
          fecha: string
          id: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          codigo: string
          company_id: string
          created_at?: string
          estado?: string
          fecha?: string
          id?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          codigo?: string
          company_id?: string
          created_at?: string
          estado?: string
          fecha?: string
          id?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planillas_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      prestashop_configurations: {
        Row: {
          api_key: string
          api_url: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          last_sync_at: string | null
          sync_frequency: number
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          api_key: string
          api_url: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          sync_frequency?: number
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          api_key?: string
          api_url?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          sync_frequency?: number
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: []
      }
      prestashop_product_mappings: {
        Row: {
          article_id: string
          company_id: string
          created_at: string
          id: string
          prestashop_combination_id: string | null
          prestashop_product_id: string
          sync_enabled: boolean
          updated_at: string
          variation_id: string | null
        }
        Insert: {
          article_id: string
          company_id: string
          created_at?: string
          id?: string
          prestashop_combination_id?: string | null
          prestashop_product_id: string
          sync_enabled?: boolean
          updated_at?: string
          variation_id?: string | null
        }
        Update: {
          article_id?: string
          company_id?: string
          created_at?: string
          id?: string
          prestashop_combination_id?: string | null
          prestashop_product_id?: string
          sync_enabled?: boolean
          updated_at?: string
          variation_id?: string | null
        }
        Relationships: []
      }
      prestashop_sync_logs: {
        Row: {
          company_id: string
          details: Json | null
          direction: string
          id: string
          message: string | null
          processed_at: string
          status: string
          sync_type: string
        }
        Insert: {
          company_id: string
          details?: Json | null
          direction: string
          id?: string
          message?: string | null
          processed_at?: string
          status: string
          sync_type: string
        }
        Update: {
          company_id?: string
          details?: Json | null
          direction?: string
          id?: string
          message?: string | null
          processed_at?: string
          status?: string
          sync_type?: string
        }
        Relationships: []
      }
      prestashop_sync_queue: {
        Row: {
          attempts: number
          company_id: string
          created_at: string
          id: string
          max_attempts: number
          payload: Json
          priority: number
          processed_at: string | null
          scheduled_at: string
          status: string
          sync_type: string
        }
        Insert: {
          attempts?: number
          company_id: string
          created_at?: string
          id?: string
          max_attempts?: number
          payload: Json
          priority?: number
          processed_at?: string | null
          scheduled_at?: string
          status?: string
          sync_type: string
        }
        Update: {
          attempts?: number
          company_id?: string
          created_at?: string
          id?: string
          max_attempts?: number
          payload?: Json
          priority?: number
          processed_at?: string | null
          scheduled_at?: string
          status?: string
          sync_type?: string
        }
        Relationships: []
      }
      presupuestos_n: {
        Row: {
          accepted_date: string | null
          company_id: string
          created_at: string
          customer_id: string
          id: string
          issue_date: string
          notes: string | null
          number: string
          status: string
          subtotal: number
          tax_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          accepted_date?: string | null
          company_id: string
          created_at?: string
          customer_id: string
          id?: string
          issue_date?: string
          notes?: string | null
          number: string
          status?: string
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          accepted_date?: string | null
          company_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          issue_date?: string
          notes?: string | null
          number?: string
          status?: string
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "presupuestos_n_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presupuestos_n_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      presupuestos_n_items: {
        Row: {
          article_id: string | null
          created_at: string
          description: string
          id: string
          presupuesto_n_id: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          article_id?: string | null
          created_at?: string
          description: string
          id?: string
          presupuesto_n_id: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Update: {
          article_id?: string | null
          created_at?: string
          description?: string
          id?: string
          presupuesto_n_id?: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "presupuestos_n_items_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presupuestos_n_items_presupuesto_n_id_fkey"
            columns: ["presupuesto_n_id"]
            isOneToOne: false
            referencedRelation: "presupuestos_n"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          created_at: string
          description: string
          id: string
          measurements: string | null
          quantity: number
          quote_id: string
          surface_area: number | null
          total_price: number
          unit_price: number
          variation_id: string | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          measurements?: string | null
          quantity?: number
          quote_id: string
          surface_area?: number | null
          total_price: number
          unit_price: number
          variation_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          measurements?: string | null
          quantity?: number
          quote_id?: string
          surface_area?: number | null
          total_price?: number
          unit_price?: number
          variation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_quote_items_quote_id"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "article_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          company_id: string | null
          created_at: string
          currency: string
          customer_id: string
          id: string
          invoice_id: string | null
          invoiced: boolean
          invoiced_at: string | null
          issue_date: string
          notes: string | null
          number: string
          status: string
          subtotal: number
          tax_amount: number
          total_amount: number
          updated_at: string
          valid_until: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          currency?: string
          customer_id: string
          id?: string
          invoice_id?: string | null
          invoiced?: boolean
          invoiced_at?: string | null
          issue_date?: string
          notes?: string | null
          number: string
          status?: string
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
          valid_until: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          currency?: string
          customer_id?: string
          id?: string
          invoice_id?: string | null
          invoiced?: boolean
          invoiced_at?: string | null
          issue_date?: string
          notes?: string | null
          number?: string
          status?: string
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system_role: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system_role?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system_role?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          article_id: string | null
          created_at: string
          description: string
          id: string
          quantity: number
          sale_id: string
          total_price: number
          unit_price: number
          variation_id: string | null
        }
        Insert: {
          article_id?: string | null
          created_at?: string
          description: string
          id?: string
          quantity?: number
          sale_id: string
          total_price?: number
          unit_price?: number
          variation_id?: string | null
        }
        Update: {
          article_id?: string | null
          created_at?: string
          description?: string
          id?: string
          quantity?: number
          sale_id?: string
          total_price?: number
          unit_price?: number
          variation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "article_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          amount_paid: number | null
          change_amount: number | null
          company_id: string | null
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          notes: string | null
          payment_method: string
          status: string
          subtotal: number
          tax_amount: number
          ticket_number: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number | null
          change_amount?: number | null
          company_id?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          notes?: string | null
          payment_method: string
          status?: string
          subtotal?: number
          tax_amount?: number
          ticket_number: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number | null
          change_amount?: number | null
          company_id?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          notes?: string | null
          payment_method?: string
          status?: string
          subtotal?: number
          tax_amount?: number
          ticket_number?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      superusers: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          last_login_at: string | null
          password_hash: string
          salt: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          password_hash: string
          salt: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          password_hash?: string
          salt?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address_city: string | null
          address_country: string | null
          address_postal_code: string | null
          address_state: string | null
          address_street: string | null
          company_id: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          payment_terms: number | null
          phone: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address_city?: string | null
          address_country?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          address_street?: string | null
          company_id?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          payment_terms?: number | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address_city?: string | null
          address_country?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          address_street?: string | null
          company_id?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          payment_terms?: number | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_type: string
          setting_value: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_type?: string
          setting_value?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_type?: string
          setting_value?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_appearance_preferences: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          sidebar_color: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          sidebar_color?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          sidebar_color?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_company_roles: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_company_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_company_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          company_id: string
          created_at: string
          id: string
          permission_id: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          permission_id: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          permission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          brand: string
          capacity: number | null
          company_id: string | null
          created_at: string
          customer_id: string
          engine: string | null
          engine_serial: string | null
          fuel_type: string | null
          hours_worked: number | null
          id: string
          license_plate: string
          model: string
          odometer: number | null
          photos: string[] | null
          status: string
          transmission: string | null
          type: string
          updated_at: string
          vin: string | null
          weight: number | null
          year: number | null
        }
        Insert: {
          brand: string
          capacity?: number | null
          company_id?: string | null
          created_at?: string
          customer_id: string
          engine?: string | null
          engine_serial?: string | null
          fuel_type?: string | null
          hours_worked?: number | null
          id?: string
          license_plate: string
          model: string
          odometer?: number | null
          photos?: string[] | null
          status?: string
          transmission?: string | null
          type: string
          updated_at?: string
          vin?: string | null
          weight?: number | null
          year?: number | null
        }
        Update: {
          brand?: string
          capacity?: number | null
          company_id?: string | null
          created_at?: string
          customer_id?: string
          engine?: string | null
          engine_serial?: string | null
          fuel_type?: string | null
          hours_worked?: number | null
          id?: string
          license_plate?: string
          model?: string
          odometer?: number | null
          photos?: string[] | null
          status?: string
          transmission?: string | null
          type?: string
          updated_at?: string
          vin?: string | null
          weight?: number | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      verifactu_certificates: {
        Row: {
          certificate_alias: string | null
          certificate_data: string
          certificate_format: string | null
          certificate_name: string
          certificate_password: string
          company_id: string | null
          created_at: string
          id: string
          is_active: boolean | null
          issuer_name: string | null
          serial_number: string | null
          subject_name: string | null
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          certificate_alias?: string | null
          certificate_data: string
          certificate_format?: string | null
          certificate_name: string
          certificate_password: string
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          issuer_name?: string | null
          serial_number?: string | null
          subject_name?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          certificate_alias?: string | null
          certificate_data?: string
          certificate_format?: string | null
          certificate_name?: string
          certificate_password?: string
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          issuer_name?: string | null
          serial_number?: string | null
          subject_name?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verifactu_certificates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      verifactu_company_config: {
        Row: {
          auto_send: boolean | null
          company_id: string | null
          created_at: string
          enable_xades_signature: boolean | null
          endpoint_url: string | null
          environment: string
          fecha_hora_ultimo_registro: string | null
          hash_anterior: string | null
          id: string
          id_software: string | null
          include_timestamp: boolean | null
          is_production: boolean | null
          max_retries: number | null
          nif_emisor: string
          nombre_razon: string
          numero_instalacion: string | null
          retry_delay_seconds: number | null
          software_name: string | null
          software_version: string | null
          timeout_seconds: number | null
          ultimo_numero_registro_anterior: number | null
          updated_at: string
          xades_signature_type: string | null
        }
        Insert: {
          auto_send?: boolean | null
          company_id?: string | null
          created_at?: string
          enable_xades_signature?: boolean | null
          endpoint_url?: string | null
          environment?: string
          fecha_hora_ultimo_registro?: string | null
          hash_anterior?: string | null
          id?: string
          id_software?: string | null
          include_timestamp?: boolean | null
          is_production?: boolean | null
          max_retries?: number | null
          nif_emisor: string
          nombre_razon: string
          numero_instalacion?: string | null
          retry_delay_seconds?: number | null
          software_name?: string | null
          software_version?: string | null
          timeout_seconds?: number | null
          ultimo_numero_registro_anterior?: number | null
          updated_at?: string
          xades_signature_type?: string | null
        }
        Update: {
          auto_send?: boolean | null
          company_id?: string | null
          created_at?: string
          enable_xades_signature?: boolean | null
          endpoint_url?: string | null
          environment?: string
          fecha_hora_ultimo_registro?: string | null
          hash_anterior?: string | null
          id?: string
          id_software?: string | null
          include_timestamp?: boolean | null
          is_production?: boolean | null
          max_retries?: number | null
          nif_emisor?: string
          nombre_razon?: string
          numero_instalacion?: string | null
          retry_delay_seconds?: number | null
          software_name?: string | null
          software_version?: string | null
          timeout_seconds?: number | null
          ultimo_numero_registro_anterior?: number | null
          updated_at?: string
          xades_signature_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verifactu_company_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      verifactu_logs: {
        Row: {
          action: string
          company_id: string | null
          created_at: string
          error_message: string | null
          id: string
          invoice_id: string | null
          request_data: Json | null
          response_data: Json | null
          status: string
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          invoice_id?: string | null
          request_data?: Json | null
          response_data?: Json | null
          status: string
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          invoice_id?: string | null
          request_data?: Json | null
          response_data?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "verifactu_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verifactu_logs_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      verifactu_queue: {
        Row: {
          action: string
          company_id: string
          created_at: string
          error_message: string | null
          id: string
          invoice_id: string
          max_retries: number
          next_retry_at: string | null
          processed_at: string | null
          request_data: Json
          retry_count: number
          status: string
          updated_at: string
        }
        Insert: {
          action: string
          company_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          invoice_id: string
          max_retries?: number
          next_retry_at?: string | null
          processed_at?: string | null
          request_data: Json
          retry_count?: number
          status?: string
          updated_at?: string
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          invoice_id?: string
          max_retries?: number
          next_retry_at?: string | null
          processed_at?: string | null
          request_data?: Json
          retry_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "verifactu_queue_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verifactu_queue_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      verifactu_xml_documents: {
        Row: {
          company_id: string | null
          created_at: string
          file_path: string | null
          id: string
          invoice_id: string | null
          xml_content: string
          xml_type: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          file_path?: string | null
          id?: string
          invoice_id?: string | null
          xml_content: string
          xml_type: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          file_path?: string | null
          id?: string
          invoice_id?: string | null
          xml_content?: string
          xml_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "verifactu_xml_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verifactu_xml_documents_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          actual_cost: number | null
          actual_hours: number | null
          assigned_technician: string | null
          company_id: string | null
          completed_at: string | null
          created_at: string
          customer_id: string
          description: string | null
          estimated_cost: number | null
          estimated_hours: number | null
          id: string
          notes: string | null
          number: string
          photos: string[] | null
          priority: string
          status: string
          title: string
          type: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          actual_cost?: number | null
          actual_hours?: number | null
          assigned_technician?: string | null
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id: string
          description?: string | null
          estimated_cost?: number | null
          estimated_hours?: number | null
          id?: string
          notes?: string | null
          number: string
          photos?: string[] | null
          priority?: string
          status?: string
          title: string
          type: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          actual_cost?: number | null
          actual_hours?: number | null
          assigned_technician?: string | null
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string
          description?: string | null
          estimated_cost?: number | null
          estimated_hours?: number | null
          id?: string
          notes?: string | null
          number?: string
          photos?: string[] | null
          priority?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      change_superuser_password: {
        Args: {
          p_current_password: string
          p_email: string
          p_new_password: string
        }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      create_superuser: {
        Args: { p_email: string; p_password: string }
        Returns: {
          created: boolean
          email: string
          user_id: string
        }[]
      }
      dearmor: { Args: { "": string }; Returns: string }
      gen_random_uuid: { Args: never; Returns: string }
      gen_salt: { Args: { "": string }; Returns: string }
      generate_delivery_note_number: {
        Args: { company_id: string; prefix: string }
        Returns: string
      }
      generate_invoice_number: {
        Args: { company_id: string; prefix: string }
        Returns: string
      }
      generate_planilla_code: { Args: { company_id: string }; Returns: string }
      generate_presupuesto_n_number: {
        Args: { company_id: string }
        Returns: string
      }
      generate_quote_number: {
        Args: { company_id: string; prefix: string }
        Returns: string
      }
      generate_ticket_number: {
        Args: { company_uuid: string }
        Returns: string
      }
      get_last_verifactu_hash: {
        Args: { p_company_id: string }
        Returns: {
          es_primer_registro: boolean
          fecha_hora_anterior: string
          hash_anterior: string
          numero_registro_anterior: number
        }[]
      }
      get_user_company_id: { Args: never; Returns: string }
      get_user_permissions: {
        Args: { company_id: string; user_id: string }
        Returns: {
          action: string
          permission_name: string
          resource: string
        }[]
      }
      pgp_armor_headers: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      update_article_stock_and_price: {
        Args: {
          article_id: string
          new_purchase_price: number
          quantity_received: number
        }
        Returns: undefined
      }
      update_company_last_verifactu_hash: {
        Args: {
          p_company_id: string
          p_fecha_hora: string
          p_hash: string
          p_numero_registro: number
        }
        Returns: undefined
      }
      user_has_permission: {
        Args: { company_id: string; permission_name: string; user_id: string }
        Returns: boolean
      }
      validate_verifactu_invoice_data: {
        Args: { p_invoice_id: string }
        Returns: boolean
      }
      verify_superuser_credentials: {
        Args: { p_email: string; p_password: string }
        Returns: {
          email: string
          is_valid: boolean
          last_login: string
          user_id: string
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
