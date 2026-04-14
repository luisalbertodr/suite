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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agenda_appointments: {
        Row: {
          color: string | null
          company_id: string
          created_at: string
          customer_id: string | null
          description: string | null
          employee_id: string | null
          end_time: string
          id: string
          start_time: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          company_id: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          employee_id?: string | null
          end_time: string
          id?: string
          start_time: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          company_id?: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          employee_id?: string | null
          end_time?: string
          id?: string
          start_time?: string
          status?: string
          title?: string
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
          {
            foreignKeyName: "agenda_appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_appointments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "agenda_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_employees: {
        Row: {
          active: boolean | null
          color: string | null
          company_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          color?: string | null
          company_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          color?: string | null
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
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
        Relationships: [
          {
            foreignKeyName: "article_families_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      article_variations: {
        Row: {
          article_id: string
          codigo_barras: string | null
          color: string | null
          created_at: string
          estado: string | null
          id: string
          iva_percentage: number | null
          precio: number | null
          precio_compra: number | null
          stock: number
          stock_actual: number | null
          stock_minimo: number | null
          talla: string | null
          updated_at: string
        }
        Insert: {
          article_id: string
          codigo_barras?: string | null
          color?: string | null
          created_at?: string
          estado?: string | null
          id?: string
          iva_percentage?: number | null
          precio?: number | null
          precio_compra?: number | null
          stock?: number
          stock_actual?: number | null
          stock_minimo?: number | null
          talla?: string | null
          updated_at?: string
        }
        Update: {
          article_id?: string
          codigo_barras?: string | null
          color?: string | null
          created_at?: string
          estado?: string | null
          id?: string
          iva_percentage?: number | null
          precio?: number | null
          precio_compra?: number | null
          stock?: number
          stock_actual?: number | null
          stock_minimo?: number | null
          talla?: string | null
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
          iva_percentage: number
          precio: number
          precio_compra: number | null
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
          familia?: string
          foto_url?: string | null
          id?: string
          iva_percentage?: number
          precio?: number
          precio_compra?: number | null
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
          iva_percentage?: number
          precio?: number
          precio_compra?: number | null
          stock_actual?: number
          stock_minimo?: number
          tipo_producto?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "articles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bono_uso: {
        Row: {
          bono_id: string
          created_at: string
          empleado_id: string | null
          fecha: string
          id: string
          notas: string | null
        }
        Insert: {
          bono_id: string
          created_at?: string
          empleado_id?: string | null
          fecha?: string
          id?: string
          notas?: string | null
        }
        Update: {
          bono_id?: string
          created_at?: string
          empleado_id?: string | null
          fecha?: string
          id?: string
          notas?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bono_uso_bono_id_fkey"
            columns: ["bono_id"]
            isOneToOne: false
            referencedRelation: "bonos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bono_uso_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "agenda_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      bonos: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string
          descripcion: string | null
          estado: string
          fecha_compra: string
          fecha_vencimiento: string | null
          id: string
          nombre: string
          precio_total: number
          sesiones_totales: number
          sesiones_usadas: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id: string
          descripcion?: string | null
          estado?: string
          fecha_compra?: string
          fecha_vencimiento?: string | null
          id?: string
          nombre: string
          precio_total?: number
          sesiones_totales?: number
          sesiones_usadas?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string
          descripcion?: string | null
          estado?: string
          fecha_compra?: string
          fecha_vencimiento?: string | null
          id?: string
          nombre?: string
          precio_total?: number
          sesiones_totales?: number
          sesiones_usadas?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bonos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonos_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      colors: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "colors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      consentimientos: {
        Row: {
          company_id: string
          contenido: string | null
          created_at: string
          customer_id: string
          fecha_firma: string | null
          firma_url: string | null
          firmado: boolean | null
          id: string
          tipo: string
          titulo: string
        }
        Insert: {
          company_id: string
          contenido?: string | null
          created_at?: string
          customer_id: string
          fecha_firma?: string | null
          firma_url?: string | null
          firmado?: boolean | null
          id?: string
          tipo: string
          titulo: string
        }
        Update: {
          company_id?: string
          contenido?: string | null
          created_at?: string
          customer_id?: string
          fecha_firma?: string | null
          firma_url?: string | null
          firmado?: boolean | null
          id?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "consentimientos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consentimientos_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
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
          company_id: string
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
          company_id: string
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
          company_id?: string
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
            foreignKeyName: "delivery_note_items_delivery_note_id_fkey"
            columns: ["delivery_note_id"]
            isOneToOne: false
            referencedRelation: "delivery_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_notes: {
        Row: {
          company_id: string
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
          company_id: string
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
          company_id?: string
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
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          parent_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "document_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category_id: string | null
          company_id: string
          created_at: string
          description: string | null
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          name: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          name: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          name?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "document_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      email_config: {
        Row: {
          company_id: string
          created_at: string
          enabled: boolean | null
          from_email: string | null
          from_name: string | null
          id: string
          smtp_host: string | null
          smtp_password_encrypted: string | null
          smtp_port: number | null
          smtp_user: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          enabled?: boolean | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          smtp_host?: string | null
          smtp_password_encrypted?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          enabled?: boolean | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          smtp_host?: string | null
          smtp_password_encrypted?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "families_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "families_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      historial_clinico: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string
          descripcion: string | null
          empleado_id: string | null
          fecha: string
          firma_cliente_url: string | null
          firma_profesional_url: string | null
          fotos_antes: string[] | null
          fotos_despues: string[] | null
          id: string
          observaciones: string | null
          tipo: string
          titulo: string
          tratamiento: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id: string
          descripcion?: string | null
          empleado_id?: string | null
          fecha?: string
          firma_cliente_url?: string | null
          firma_profesional_url?: string | null
          fotos_antes?: string[] | null
          fotos_despues?: string[] | null
          id?: string
          observaciones?: string | null
          tipo?: string
          titulo: string
          tratamiento?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string
          descripcion?: string | null
          empleado_id?: string | null
          fecha?: string
          firma_cliente_url?: string | null
          firma_profesional_url?: string | null
          fotos_antes?: string[] | null
          fotos_despues?: string[] | null
          id?: string
          observaciones?: string | null
          tipo?: string
          titulo?: string
          tratamiento?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "historial_clinico_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historial_clinico_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historial_clinico_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "agenda_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          article_id: string | null
          created_at: string
          description: string
          discount_percent: number | null
          discount_percentage: number | null
          id: string
          invoice_id: string
          iva_amount: number | null
          iva_percentage: number | null
          quantity: number
          re_amount: number | null
          re_percentage: number | null
          sort_order: number | null
          subtotal_after_discount: number | null
          tax_percent: number
          total_price: number
          unit_price: number
          variation_id: string | null
        }
        Insert: {
          article_id?: string | null
          created_at?: string
          description: string
          discount_percent?: number | null
          discount_percentage?: number | null
          id?: string
          invoice_id: string
          iva_amount?: number | null
          iva_percentage?: number | null
          quantity?: number
          re_amount?: number | null
          re_percentage?: number | null
          sort_order?: number | null
          subtotal_after_discount?: number | null
          tax_percent?: number
          total_price?: number
          unit_price?: number
          variation_id?: string | null
        }
        Update: {
          article_id?: string | null
          created_at?: string
          description?: string
          discount_percent?: number | null
          discount_percentage?: number | null
          id?: string
          invoice_id?: string
          iva_amount?: number | null
          iva_percentage?: number | null
          quantity?: number
          re_amount?: number | null
          re_percentage?: number | null
          sort_order?: number | null
          subtotal_after_discount?: number | null
          tax_percent?: number
          total_price?: number
          unit_price?: number
          variation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          clave_regimen_especial: string | null
          company_id: string
          corrective_reason: string | null
          created_at: string
          currency: string | null
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
          paid_status: boolean | null
          payment_method: string | null
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
          verifactu_hash: string | null
          verifactu_huella: string | null
          verifactu_numero_registro: string | null
          verifactu_qr: string | null
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
          company_id: string
          corrective_reason?: string | null
          created_at?: string
          currency?: string | null
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
          paid_status?: boolean | null
          payment_method?: string | null
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
          verifactu_hash?: string | null
          verifactu_huella?: string | null
          verifactu_numero_registro?: string | null
          verifactu_qr?: string | null
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
          company_id?: string
          corrective_reason?: string | null
          created_at?: string
          currency?: string | null
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
          paid_status?: boolean | null
          payment_method?: string | null
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
          verifactu_hash?: string | null
          verifactu_huella?: string | null
          verifactu_numero_registro?: string | null
          verifactu_qr?: string | null
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
        ]
      }
      permissions: {
        Row: {
          action: string
          created_at: string
          description: string | null
          id: string
          name: string | null
          resource: string
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string | null
          resource: string
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string | null
          resource?: string
        }
        Relationships: []
      }
      planilla_items: {
        Row: {
          article_id: string | null
          created_at: string
          customer_id: string | null
          description: string | null
          id: string
          notes: string | null
          planilla_id: string
          quantity: number
          row_index: number
          updated_at: string
        }
        Insert: {
          article_id?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          planilla_id: string
          quantity?: number
          row_index?: number
          updated_at?: string
        }
        Update: {
          article_id?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          planilla_id?: string
          quantity?: number
          row_index?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planilla_items_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planilla_items_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
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
          company_id: string
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planillas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      prestashop_config: {
        Row: {
          api_key_encrypted: string | null
          api_url: string | null
          company_id: string
          created_at: string
          enabled: boolean | null
          id: string
          last_sync_at: string | null
          sync_orders: boolean | null
          sync_products: boolean | null
          sync_stock: boolean | null
          updated_at: string
        }
        Insert: {
          api_key_encrypted?: string | null
          api_url?: string | null
          company_id: string
          created_at?: string
          enabled?: boolean | null
          id?: string
          last_sync_at?: string | null
          sync_orders?: boolean | null
          sync_products?: boolean | null
          sync_stock?: boolean | null
          updated_at?: string
        }
        Update: {
          api_key_encrypted?: string | null
          api_url?: string | null
          company_id?: string
          created_at?: string
          enabled?: boolean | null
          id?: string
          last_sync_at?: string | null
          sync_orders?: boolean | null
          sync_products?: boolean | null
          sync_stock?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prestashop_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      prestashop_mappings: {
        Row: {
          article_id: string | null
          company_id: string
          created_at: string
          id: string
          last_synced_at: string | null
          prestashop_product_id: number
        }
        Insert: {
          article_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          last_synced_at?: string | null
          prestashop_product_id: number
        }
        Update: {
          article_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          last_synced_at?: string | null
          prestashop_product_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "prestashop_mappings_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prestashop_mappings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      prestashop_sync_logs: {
        Row: {
          company_id: string
          created_at: string
          error_message: string | null
          id: string
          items_synced: number | null
          status: string
          sync_type: string
        }
        Insert: {
          company_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          items_synced?: number | null
          status: string
          sync_type: string
        }
        Update: {
          company_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          items_synced?: number | null
          status?: string
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "prestashop_sync_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      presupuesto_n_items: {
        Row: {
          article_id: string | null
          created_at: string
          description: string
          discount_percent: number | null
          id: string
          presupuesto_id: string
          quantity: number
          sort_order: number | null
          tax_percent: number
          total_price: number
          unit_price: number
        }
        Insert: {
          article_id?: string | null
          created_at?: string
          description: string
          discount_percent?: number | null
          id?: string
          presupuesto_id: string
          quantity?: number
          sort_order?: number | null
          tax_percent?: number
          total_price?: number
          unit_price?: number
        }
        Update: {
          article_id?: string | null
          created_at?: string
          description?: string
          discount_percent?: number | null
          id?: string
          presupuesto_id?: string
          quantity?: number
          sort_order?: number | null
          tax_percent?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "presupuesto_n_items_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presupuesto_n_items_presupuesto_id_fkey"
            columns: ["presupuesto_id"]
            isOneToOne: false
            referencedRelation: "presupuestos_n"
            referencedColumns: ["id"]
          },
        ]
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
          terms: string | null
          total_amount: number
          updated_at: string
          valid_until: string
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
          terms?: string | null
          total_amount?: number
          updated_at?: string
          valid_until: string
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
          terms?: string | null
          total_amount?: number
          updated_at?: string
          valid_until?: string
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
      quote_items: {
        Row: {
          article_id: string | null
          created_at: string
          description: string
          discount_percent: number | null
          id: string
          measurements: string | null
          quantity: number
          quote_id: string
          sort_order: number | null
          surface_area: number | null
          tax_percent: number
          total_price: number
          unit_price: number
        }
        Insert: {
          article_id?: string | null
          created_at?: string
          description: string
          discount_percent?: number | null
          id?: string
          measurements?: string | null
          quantity?: number
          quote_id: string
          sort_order?: number | null
          surface_area?: number | null
          tax_percent?: number
          total_price?: number
          unit_price?: number
        }
        Update: {
          article_id?: string | null
          created_at?: string
          description?: string
          discount_percent?: number | null
          id?: string
          measurements?: string | null
          quantity?: number
          quote_id?: string
          sort_order?: number | null
          surface_area?: number | null
          tax_percent?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          company_id: string
          created_at: string
          currency: string | null
          customer_id: string
          id: string
          invoice_id: string | null
          invoiced: boolean | null
          invoiced_at: string | null
          issue_date: string
          notes: string | null
          number: string
          status: string
          subtotal: number
          tax_amount: number
          terms: string | null
          total_amount: number
          updated_at: string
          valid_until: string
        }
        Insert: {
          company_id: string
          created_at?: string
          currency?: string | null
          customer_id: string
          id?: string
          invoice_id?: string | null
          invoiced?: boolean | null
          invoiced_at?: string | null
          issue_date?: string
          notes?: string | null
          number: string
          status?: string
          subtotal?: number
          tax_amount?: number
          terms?: string | null
          total_amount?: number
          updated_at?: string
          valid_until: string
        }
        Update: {
          company_id?: string
          created_at?: string
          currency?: string | null
          customer_id?: string
          id?: string
          invoice_id?: string | null
          invoiced?: boolean | null
          invoiced_at?: string | null
          issue_date?: string
          notes?: string | null
          number?: string
          status?: string
          subtotal?: number
          tax_amount?: number
          terms?: string | null
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
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          article_id: string | null
          created_at: string
          description: string | null
          id: string
          quantity: number | null
          sale_id: string
          total_price: number | null
          unit_price: number | null
        }
        Insert: {
          article_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          quantity?: number | null
          sale_id: string
          total_price?: number | null
          unit_price?: number | null
        }
        Update: {
          article_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          quantity?: number | null
          sale_id?: string
          total_price?: number | null
          unit_price?: number | null
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
        ]
      }
      sales: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string | null
          customer_name: string | null
          id: string
          payment_method: string | null
          status: string | null
          ticket_number: string
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          payment_method?: string | null
          status?: string | null
          ticket_number: string
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          payment_method?: string | null
          status?: string | null
          ticket_number?: string
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      superusers: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string | null
          password_hash: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name?: string | null
          password_hash: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          password_hash?: string
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
          company_id: string
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
          website: string | null
        }
        Insert: {
          address_city?: string | null
          address_country?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          address_street?: string | null
          company_id: string
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
          website?: string | null
        }
        Update: {
          address_city?: string | null
          address_country?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          address_street?: string | null
          company_id?: string
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
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          setting_key: string
          setting_value: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          setting_key: string
          setting_value?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_company_roles: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          role: string
          role_id: string | null
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          role?: string
          role_id?: string | null
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          role?: string
          role_id?: string | null
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
          company_id: string | null
          created_at: string
          id: string
          permission_id: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          permission_id: string
          user_id: string
        }
        Update: {
          company_id?: string | null
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
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string
          dark_mode: boolean | null
          display_name: string | null
          email: string | null
          id: string
          language: string | null
          phone: string | null
          sidebar_collapsed: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          dark_mode?: boolean | null
          display_name?: string | null
          email?: string | null
          id?: string
          language?: string | null
          phone?: string | null
          sidebar_collapsed?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          dark_mode?: boolean | null
          display_name?: string | null
          email?: string | null
          id?: string
          language?: string | null
          phone?: string | null
          sidebar_collapsed?: boolean | null
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
          role?: Database["public"]["Enums"]["app_role"]
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
      verifactu_certificates: {
        Row: {
          certificate_data: string | null
          certificate_name: string
          certificate_password_encrypted: string | null
          company_id: string
          created_at: string
          expiry_date: string | null
          id: string
          is_active: boolean | null
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          certificate_data?: string | null
          certificate_name: string
          certificate_password_encrypted?: string | null
          company_id: string
          created_at?: string
          expiry_date?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          certificate_data?: string | null
          certificate_name?: string
          certificate_password_encrypted?: string | null
          company_id?: string
          created_at?: string
          expiry_date?: string | null
          id?: string
          is_active?: boolean | null
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
          company_id: string
          created_at: string
          enable_xades_signature: boolean | null
          endpoint_url: string | null
          environment: string | null
          hash_anterior: string | null
          id: string
          id_software: string | null
          include_timestamp: boolean | null
          max_retries: number | null
          nif_emisor: string | null
          nombre_razon: string | null
          numero_instalacion: string | null
          retry_delay_seconds: number | null
          software_name: string | null
          software_version: string | null
          timeout_seconds: number | null
          updated_at: string
          xades_signature_type: string | null
        }
        Insert: {
          auto_send?: boolean | null
          company_id: string
          created_at?: string
          enable_xades_signature?: boolean | null
          endpoint_url?: string | null
          environment?: string | null
          hash_anterior?: string | null
          id?: string
          id_software?: string | null
          include_timestamp?: boolean | null
          max_retries?: number | null
          nif_emisor?: string | null
          nombre_razon?: string | null
          numero_instalacion?: string | null
          retry_delay_seconds?: number | null
          software_name?: string | null
          software_version?: string | null
          timeout_seconds?: number | null
          updated_at?: string
          xades_signature_type?: string | null
        }
        Update: {
          auto_send?: boolean | null
          company_id?: string
          created_at?: string
          enable_xades_signature?: boolean | null
          endpoint_url?: string | null
          environment?: string | null
          hash_anterior?: string | null
          id?: string
          id_software?: string | null
          include_timestamp?: boolean | null
          max_retries?: number | null
          nif_emisor?: string | null
          nombre_razon?: string | null
          numero_instalacion?: string | null
          retry_delay_seconds?: number | null
          software_name?: string | null
          software_version?: string | null
          timeout_seconds?: number | null
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
      verifactu_config: {
        Row: {
          certificate_data: string | null
          certificate_expiry: string | null
          certificate_password_encrypted: string | null
          company_id: string
          created_at: string
          enabled: boolean | null
          environment: string | null
          id: string
          software_id: string | null
          software_name: string | null
          software_version: string | null
          updated_at: string
        }
        Insert: {
          certificate_data?: string | null
          certificate_expiry?: string | null
          certificate_password_encrypted?: string | null
          company_id: string
          created_at?: string
          enabled?: boolean | null
          environment?: string | null
          id?: string
          software_id?: string | null
          software_name?: string | null
          software_version?: string | null
          updated_at?: string
        }
        Update: {
          certificate_data?: string | null
          certificate_expiry?: string | null
          certificate_password_encrypted?: string | null
          company_id?: string
          created_at?: string
          enabled?: boolean | null
          environment?: string | null
          id?: string
          software_id?: string | null
          software_name?: string | null
          software_version?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "verifactu_config_company_id_fkey"
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
          company_id: string
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
          company_id: string
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
          company_id?: string
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
          attempts: number | null
          company_id: string
          created_at: string
          error_message: string | null
          id: string
          invoice_id: string
          last_attempt_at: string | null
          max_retries: number | null
          next_retry_at: string | null
          processed_at: string | null
          retry_count: number | null
          status: string
        }
        Insert: {
          action?: string
          attempts?: number | null
          company_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          invoice_id: string
          last_attempt_at?: string | null
          max_retries?: number | null
          next_retry_at?: string | null
          processed_at?: string | null
          retry_count?: number | null
          status?: string
        }
        Update: {
          action?: string
          attempts?: number | null
          company_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          invoice_id?: string
          last_attempt_at?: string | null
          max_retries?: number | null
          next_retry_at?: string | null
          processed_at?: string | null
          retry_count?: number | null
          status?: string
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
          company_id: string
          created_at: string
          document_type: string
          id: string
          invoice_id: string | null
          sent: boolean | null
          signed: boolean | null
          xml_content: string
          xml_type: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          document_type: string
          id?: string
          invoice_id?: string | null
          sent?: boolean | null
          signed?: boolean | null
          xml_content: string
          xml_type?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          document_type?: string
          id?: string
          invoice_id?: string | null
          sent?: boolean | null
          signed?: boolean | null
          xml_content?: string
          xml_type?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_superuser: {
        Args: { p_email: string; p_password: string }
        Returns: string
      }
      generate_delivery_note_number: {
        Args: { p_company_id: string }
        Returns: string
      }
      generate_invoice_number: {
        Args: { p_company_id: string; p_is_corrective?: boolean }
        Returns: string
      }
      generate_planilla_code: {
        Args: { p_company_id: string }
        Returns: string
      }
      generate_presupuesto_n_number: {
        Args: { p_company_id: string }
        Returns: string
      }
      get_user_company_id: { Args: never; Returns: string }
      get_user_permissions: { Args: { p_user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user" | "superuser"
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
      app_role: ["admin", "user", "superuser"],
    },
  },
} as const
