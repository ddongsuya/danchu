// 자동 생성: npm run gen:db-types (scripts/gen-db-types.mjs). 손으로 고치지 않는다.
// 마이그레이션을 운영 DB 에 적용한 뒤 다시 만든다.
/* eslint-disable */
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
      admin_audit: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          id: string
          note: string | null
          target_id: string | null
          target_label: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          note?: string | null
          target_id?: string | null
          target_label?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          note?: string | null
          target_id?: string | null
          target_label?: string | null
          target_type?: string
        }
        Relationships: []
      }
      billing_adjustments: {
        Row: {
          amount: number
          corrects_month: string | null
          created_at: string
          created_by: string | null
          id: string
          month: string
          org_id: string
          reason: string
        }
        Insert: {
          amount: number
          corrects_month?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          month: string
          org_id: string
          reason: string
        }
        Update: {
          amount?: number
          corrects_month?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          month?: string
          org_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_adjustments_corrects_month_fkey"
            columns: ["corrects_month"]
            isOneToOne: false
            referencedRelation: "billing_periods"
            referencedColumns: ["month"]
          },
          {
            foreignKeyName: "billing_adjustments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "cro_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_invoices: {
        Row: {
          detail: Json
          due_date: string
          id: string
          invoice_no: string
          issued_at: string
          issued_by: string | null
          last_sent_at: string | null
          month: string
          org_id: string
          org_name: string
          paid_at: string | null
          paid_by: string | null
          paid_note: string | null
          paid_on: string | null
          reminder_stage: number
          sent_at: string | null
          sent_count: number
          status: string
          supply_amount: number
          total: number
          vat: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          detail?: Json
          due_date: string
          id?: string
          invoice_no: string
          issued_at?: string
          issued_by?: string | null
          last_sent_at?: string | null
          month: string
          org_id: string
          org_name: string
          paid_at?: string | null
          paid_by?: string | null
          paid_note?: string | null
          paid_on?: string | null
          reminder_stage?: number
          sent_at?: string | null
          sent_count?: number
          status?: string
          supply_amount: number
          total: number
          vat: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          detail?: Json
          due_date?: string
          id?: string
          invoice_no?: string
          issued_at?: string
          issued_by?: string | null
          last_sent_at?: string | null
          month?: string
          org_id?: string
          org_name?: string
          paid_at?: string | null
          paid_by?: string | null
          paid_note?: string | null
          paid_on?: string | null
          reminder_stage?: number
          sent_at?: string | null
          sent_count?: number
          status?: string
          supply_amount?: number
          total?: number
          vat?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_invoices_month_fkey"
            columns: ["month"]
            isOneToOne: false
            referencedRelation: "billing_periods"
            referencedColumns: ["month"]
          },
          {
            foreignKeyName: "billing_invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "cro_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_periods: {
        Row: {
          closed_at: string
          closed_by: string | null
          month: string
          note: string | null
          snapshot: Json | null
        }
        Insert: {
          closed_at?: string
          closed_by?: string | null
          month: string
          note?: string | null
          snapshot?: Json | null
        }
        Update: {
          closed_at?: string
          closed_by?: string | null
          month?: string
          note?: string | null
          snapshot?: Json | null
        }
        Relationships: []
      }
      cro_catalog: {
        Row: {
          after_keys: string[]
          available: boolean
          category: string
          cond_prices: Json
          created_at: string
          dosing: string | null
          extra: Json
          glp: string
          groups_ctrl: number | null
          groups_test: number | null
          id: string
          includes: string[]
          item: string
          item_key: string
          last_amount: number | null
          last_quoted_at: string | null
          last_weeks: number | null
          method: string | null
          note: string | null
          options: Json
          org_id: string
          per_sex: number | null
          price_max: number | null
          price_min: number | null
          recovery_per_sex: number | null
          recovery_weeks: number | null
          report_weeks: number | null
          route: string | null
          routes: string[]
          sort: number
          source: string
          species: string[]
          std_price: number | null
          translation_weeks: number | null
          unit: string
          updated_at: string
          weeks: number | null
        }
        Insert: {
          after_keys?: string[]
          available?: boolean
          category: string
          cond_prices?: Json
          created_at?: string
          dosing?: string | null
          extra?: Json
          glp?: string
          groups_ctrl?: number | null
          groups_test?: number | null
          id?: string
          includes?: string[]
          item: string
          item_key: string
          last_amount?: number | null
          last_quoted_at?: string | null
          last_weeks?: number | null
          method?: string | null
          note?: string | null
          options?: Json
          org_id: string
          per_sex?: number | null
          price_max?: number | null
          price_min?: number | null
          recovery_per_sex?: number | null
          recovery_weeks?: number | null
          report_weeks?: number | null
          route?: string | null
          routes?: string[]
          sort?: number
          source?: string
          species?: string[]
          std_price?: number | null
          translation_weeks?: number | null
          unit?: string
          updated_at?: string
          weeks?: number | null
        }
        Update: {
          after_keys?: string[]
          available?: boolean
          category?: string
          cond_prices?: Json
          created_at?: string
          dosing?: string | null
          extra?: Json
          glp?: string
          groups_ctrl?: number | null
          groups_test?: number | null
          id?: string
          includes?: string[]
          item?: string
          item_key?: string
          last_amount?: number | null
          last_quoted_at?: string | null
          last_weeks?: number | null
          method?: string | null
          note?: string | null
          options?: Json
          org_id?: string
          per_sex?: number | null
          price_max?: number | null
          price_min?: number | null
          recovery_per_sex?: number | null
          recovery_weeks?: number | null
          report_weeks?: number | null
          route?: string | null
          routes?: string[]
          sort?: number
          source?: string
          species?: string[]
          std_price?: number | null
          translation_weeks?: number | null
          unit?: string
          updated_at?: string
          weeks?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cro_catalog_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "cro_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      cro_crm_activities: {
        Row: {
          attendee_contacts: string[]
          attendee_members: string[]
          body: string
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          duration_min: number | null
          event_id: string | null
          id: string
          kind: string
          occurred_at: string
          org_id: string
          quote_doc_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          attendee_contacts?: string[]
          attendee_members?: string[]
          body?: string
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          duration_min?: number | null
          event_id?: string | null
          id?: string
          kind: string
          occurred_at?: string
          org_id: string
          quote_doc_id?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          attendee_contacts?: string[]
          attendee_members?: string[]
          body?: string
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          duration_min?: number | null
          event_id?: string | null
          id?: string
          kind?: string
          occurred_at?: string
          org_id?: string
          quote_doc_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cro_crm_activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "cro_crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_crm_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "cro_crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_crm_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_crm_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "cro_crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_crm_activities_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "cro_crm_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_crm_activities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "cro_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_crm_activities_quote_doc_id_fkey"
            columns: ["quote_doc_id"]
            isOneToOne: false
            referencedRelation: "cro_quote_docs"
            referencedColumns: ["id"]
          },
        ]
      }
      cro_crm_companies: {
        Row: {
          address: string
          aliases: string[]
          biz_no: string
          created_at: string
          created_by: string | null
          email_domain: string
          first_deal_on: string | null
          id: string
          industry: string
          memo: string
          name: string
          org_id: string
          owner: string | null
          source: string
          updated_at: string
          website: string
        }
        Insert: {
          address?: string
          aliases?: string[]
          biz_no?: string
          created_at?: string
          created_by?: string | null
          email_domain?: string
          first_deal_on?: string | null
          id?: string
          industry?: string
          memo?: string
          name: string
          org_id: string
          owner?: string | null
          source?: string
          updated_at?: string
          website?: string
        }
        Update: {
          address?: string
          aliases?: string[]
          biz_no?: string
          created_at?: string
          created_by?: string | null
          email_domain?: string
          first_deal_on?: string | null
          id?: string
          industry?: string
          memo?: string
          name?: string
          org_id?: string
          owner?: string | null
          source?: string
          updated_at?: string
          website?: string
        }
        Relationships: [
          {
            foreignKeyName: "cro_crm_companies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_crm_companies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "cro_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_crm_companies_owner_fkey"
            columns: ["owner"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cro_crm_contacts: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          danchu_key: string | null
          dept: string
          email: string
          id: string
          memo: string
          mobile: string
          name: string
          org_id: string
          phone: string
          role: string | null
          source: string
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          danchu_key?: string | null
          dept?: string
          email?: string
          id?: string
          memo?: string
          mobile?: string
          name: string
          org_id: string
          phone?: string
          role?: string | null
          source?: string
          title?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          danchu_key?: string | null
          dept?: string
          email?: string
          id?: string
          memo?: string
          mobile?: string
          name?: string
          org_id?: string
          phone?: string
          role?: string | null
          source?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cro_crm_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "cro_crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_crm_contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_crm_contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "cro_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      cro_crm_deal_history: {
        Row: {
          actor: string
          at: string
          created_by: string | null
          deal_id: string
          from_stage: string | null
          from_status: string | null
          id: string
          org_id: string
          reason: string
          to_stage: string
          to_status: string
        }
        Insert: {
          actor?: string
          at?: string
          created_by?: string | null
          deal_id: string
          from_stage?: string | null
          from_status?: string | null
          id?: string
          org_id: string
          reason?: string
          to_stage: string
          to_status: string
        }
        Update: {
          actor?: string
          at?: string
          created_by?: string | null
          deal_id?: string
          from_stage?: string | null
          from_status?: string | null
          id?: string
          org_id?: string
          reason?: string
          to_stage?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cro_crm_deal_history_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_crm_deal_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "cro_crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_crm_deal_history_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "cro_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      cro_crm_deals: {
        Row: {
          amount: number | null
          closed_at: string | null
          company_id: string | null
          contact_ids: string[]
          created_at: string
          created_by: string | null
          expected_on: string | null
          id: string
          import_id: string | null
          invite_id: string | null
          kind: string
          lost_note: string
          lost_reason: string
          memo: string
          org_id: string
          owner: string | null
          report_lang: string
          rfq_no: string
          source: string
          stage: string
          stage_at: string
          status: string
          submit_to: string
          substance: string
          title: string
          updated_at: string
          won_amount: number | null
        }
        Insert: {
          amount?: number | null
          closed_at?: string | null
          company_id?: string | null
          contact_ids?: string[]
          created_at?: string
          created_by?: string | null
          expected_on?: string | null
          id?: string
          import_id?: string | null
          invite_id?: string | null
          kind?: string
          lost_note?: string
          lost_reason?: string
          memo?: string
          org_id: string
          owner?: string | null
          report_lang?: string
          rfq_no?: string
          source?: string
          stage?: string
          stage_at?: string
          status?: string
          submit_to?: string
          substance?: string
          title: string
          updated_at?: string
          won_amount?: number | null
        }
        Update: {
          amount?: number | null
          closed_at?: string | null
          company_id?: string | null
          contact_ids?: string[]
          created_at?: string
          created_by?: string | null
          expected_on?: string | null
          id?: string
          import_id?: string | null
          invite_id?: string | null
          kind?: string
          lost_note?: string
          lost_reason?: string
          memo?: string
          org_id?: string
          owner?: string | null
          report_lang?: string
          rfq_no?: string
          source?: string
          stage?: string
          stage_at?: string
          status?: string
          submit_to?: string
          substance?: string
          title?: string
          updated_at?: string
          won_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cro_crm_deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "cro_crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_crm_deals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_crm_deals_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "cro_crm_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_crm_deals_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "rfq_invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_crm_deals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "cro_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_crm_deals_owner_fkey"
            columns: ["owner"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cro_crm_events: {
        Row: {
          all_day: boolean
          attendee_contacts: string[]
          attendee_members: string[]
          attendees_extra: string
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          done_at: string | null
          ends_at: string | null
          id: string
          kind: string
          location: string
          mode: string | null
          org_id: string
          quote_doc_id: string | null
          remind: boolean
          reminded_at: string | null
          requests: string
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          attendee_contacts?: string[]
          attendee_members?: string[]
          attendees_extra?: string
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          done_at?: string | null
          ends_at?: string | null
          id?: string
          kind?: string
          location?: string
          mode?: string | null
          org_id: string
          quote_doc_id?: string | null
          remind?: boolean
          reminded_at?: string | null
          requests?: string
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          attendee_contacts?: string[]
          attendee_members?: string[]
          attendees_extra?: string
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          done_at?: string | null
          ends_at?: string | null
          id?: string
          kind?: string
          location?: string
          mode?: string | null
          org_id?: string
          quote_doc_id?: string | null
          remind?: boolean
          reminded_at?: string | null
          requests?: string
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cro_crm_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "cro_crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_crm_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "cro_crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_crm_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_crm_events_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "cro_crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_crm_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "cro_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_crm_events_quote_doc_id_fkey"
            columns: ["quote_doc_id"]
            isOneToOne: false
            referencedRelation: "cro_quote_docs"
            referencedColumns: ["id"]
          },
        ]
      }
      cro_crm_imports: {
        Row: {
          company_ids: string[]
          contact_ids: string[]
          created_at: string
          created_by: string | null
          deal_ids: string[]
          file_name: string
          id: string
          org_id: string
          row_count: number
          undone_at: string | null
        }
        Insert: {
          company_ids?: string[]
          contact_ids?: string[]
          created_at?: string
          created_by?: string | null
          deal_ids?: string[]
          file_name?: string
          id?: string
          org_id: string
          row_count?: number
          undone_at?: string | null
        }
        Update: {
          company_ids?: string[]
          contact_ids?: string[]
          created_at?: string
          created_by?: string | null
          deal_ids?: string[]
          file_name?: string
          id?: string
          org_id?: string
          row_count?: number
          undone_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cro_crm_imports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_crm_imports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "cro_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      cro_crm_task_actions: {
        Row: {
          at: string
          body: string
          created_at: string
          created_by: string | null
          id: string
          org_id: string
          task_id: string
        }
        Insert: {
          at?: string
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          org_id: string
          task_id: string
        }
        Update: {
          at?: string
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cro_crm_task_actions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_crm_task_actions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "cro_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_crm_task_actions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "cro_crm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      cro_crm_tasks: {
        Row: {
          activity_id: string | null
          assignee: string | null
          category: string
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          done_at: string | null
          done_by: string | null
          due_on: string | null
          id: string
          memo: string
          notified_on: string | null
          org_id: string
          quote_doc_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          activity_id?: string | null
          assignee?: string | null
          category?: string
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          done_at?: string | null
          done_by?: string | null
          due_on?: string | null
          id?: string
          memo?: string
          notified_on?: string | null
          org_id: string
          quote_doc_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          activity_id?: string | null
          assignee?: string | null
          category?: string
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          done_at?: string | null
          done_by?: string | null
          due_on?: string | null
          id?: string
          memo?: string
          notified_on?: string | null
          org_id?: string
          quote_doc_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cro_crm_tasks_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "cro_crm_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_crm_tasks_assignee_fkey"
            columns: ["assignee"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_crm_tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "cro_crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_crm_tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "cro_crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_crm_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_crm_tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "cro_crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_crm_tasks_done_by_fkey"
            columns: ["done_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_crm_tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "cro_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_crm_tasks_quote_doc_id_fkey"
            columns: ["quote_doc_id"]
            isOneToOne: false
            referencedRelation: "cro_quote_docs"
            referencedColumns: ["id"]
          },
        ]
      }
      cro_org_presets: {
        Row: {
          note: string | null
          offered: boolean
          org_id: string
          package_price: number | null
          preset_key: string
          updated_at: string
        }
        Insert: {
          note?: string | null
          offered?: boolean
          org_id: string
          package_price?: number | null
          preset_key: string
          updated_at?: string
        }
        Update: {
          note?: string | null
          offered?: boolean
          org_id?: string
          package_price?: number | null
          preset_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cro_org_presets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "cro_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      cro_orgs: {
        Row: {
          aaalac: boolean | null
          address: string | null
          approved_at: string | null
          auto_reply: boolean
          billing_email: string | null
          business_no: string | null
          business_no_norm: string | null
          categories: string[]
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          fee_rate: number | null
          glp_certs: string[]
          id: string
          intro: string | null
          managed: boolean
          members_left_at: string | null
          monthly_fee: number | null
          monthly_fee_from: string | null
          name: string
          other_certs: string | null
          per_request_fee: number | null
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          aaalac?: boolean | null
          address?: string | null
          approved_at?: string | null
          auto_reply?: boolean
          billing_email?: string | null
          business_no?: string | null
          business_no_norm?: string | null
          categories?: string[]
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          fee_rate?: number | null
          glp_certs?: string[]
          id?: string
          intro?: string | null
          managed?: boolean
          members_left_at?: string | null
          monthly_fee?: number | null
          monthly_fee_from?: string | null
          name: string
          other_certs?: string | null
          per_request_fee?: number | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          aaalac?: boolean | null
          address?: string | null
          approved_at?: string | null
          auto_reply?: boolean
          billing_email?: string | null
          business_no?: string | null
          business_no_norm?: string | null
          categories?: string[]
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          fee_rate?: number | null
          glp_certs?: string[]
          id?: string
          intro?: string | null
          managed?: boolean
          members_left_at?: string | null
          monthly_fee?: number | null
          monthly_fee_from?: string | null
          name?: string
          other_certs?: string | null
          per_request_fee?: number | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      cro_quote_addons: {
        Row: {
          amount: number | null
          id: string
          level: string | null
          name: string
          quote_id: string
          reason: string | null
          seq: number
          weeks: number | null
        }
        Insert: {
          amount?: number | null
          id?: string
          level?: string | null
          name: string
          quote_id: string
          reason?: string | null
          seq: number
          weeks?: number | null
        }
        Update: {
          amount?: number | null
          id?: string
          level?: string | null
          name?: string
          quote_id?: string
          reason?: string | null
          seq?: number
          weeks?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cro_quote_addons_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "cro_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      cro_quote_design_requests: {
        Row: {
          created_at: string
          created_by: string | null
          files: Json
          id: string
          note: string
          org_id: string
          reply: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          files?: Json
          id?: string
          note?: string
          org_id: string
          reply?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          files?: Json
          id?: string
          note?: string
          org_id?: string
          reply?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cro_quote_design_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_quote_design_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "cro_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      cro_quote_docs: {
        Row: {
          client: string
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          data: Json
          deal_id: string | null
          doc_no: string
          id: string
          invite_id: string | null
          issued_on: string
          memo: string
          org_id: string
          rfq_no: string | null
          sent_at: string | null
          status: string
          substance: string
          supply: number
          title: string
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          client?: string
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          data?: Json
          deal_id?: string | null
          doc_no: string
          id?: string
          invite_id?: string | null
          issued_on?: string
          memo?: string
          org_id: string
          rfq_no?: string | null
          sent_at?: string | null
          status?: string
          substance?: string
          supply?: number
          title?: string
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          client?: string
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          data?: Json
          deal_id?: string | null
          doc_no?: string
          id?: string
          invite_id?: string | null
          issued_on?: string
          memo?: string
          org_id?: string
          rfq_no?: string | null
          sent_at?: string | null
          status?: string
          substance?: string
          supply?: number
          title?: string
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cro_quote_docs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "cro_crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_quote_docs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "cro_crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_quote_docs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_quote_docs_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "cro_crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_quote_docs_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "rfq_invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_quote_docs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "cro_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      cro_quote_items: {
        Row: {
          after_seqs: number[]
          amount: number | null
          avail: string | null
          category: string
          cond: string | null
          design: Json
          dosing: string | null
          excluded: string | null
          glp: string | null
          groups: number | null
          id: string
          includes: string[]
          name: string
          note: string | null
          options: Json
          per_group: string | null
          quote_id: string
          reason: string | null
          report_weeks: number | null
          route: string | null
          sample_count: number | null
          seq: number
          source: string | null
          species: string | null
          start_date: string | null
          translation_weeks: number | null
          unit: string
          unit_price: number | null
          weeks: number | null
        }
        Insert: {
          after_seqs?: number[]
          amount?: number | null
          avail?: string | null
          category: string
          cond?: string | null
          design?: Json
          dosing?: string | null
          excluded?: string | null
          glp?: string | null
          groups?: number | null
          id?: string
          includes?: string[]
          name: string
          note?: string | null
          options?: Json
          per_group?: string | null
          quote_id: string
          reason?: string | null
          report_weeks?: number | null
          route?: string | null
          sample_count?: number | null
          seq: number
          source?: string | null
          species?: string | null
          start_date?: string | null
          translation_weeks?: number | null
          unit?: string
          unit_price?: number | null
          weeks?: number | null
        }
        Update: {
          after_seqs?: number[]
          amount?: number | null
          avail?: string | null
          category?: string
          cond?: string | null
          design?: Json
          dosing?: string | null
          excluded?: string | null
          glp?: string | null
          groups?: number | null
          id?: string
          includes?: string[]
          name?: string
          note?: string | null
          options?: Json
          per_group?: string | null
          quote_id?: string
          reason?: string | null
          report_weeks?: number | null
          route?: string | null
          sample_count?: number | null
          seq?: number
          source?: string | null
          species?: string | null
          start_date?: string | null
          translation_weeks?: number | null
          unit?: string
          unit_price?: number | null
          weeks?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cro_quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "cro_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      cro_quote_rates: {
        Row: {
          item_key: string
          org_id: string
          rates: Json
          updated_at: string
        }
        Insert: {
          item_key: string
          org_id: string
          rates?: Json
          updated_at?: string
        }
        Update: {
          item_key?: string
          org_id?: string
          rates?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cro_quote_rates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "cro_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      cro_quote_style: {
        Row: {
          brand_color: string | null
          logo_data: string | null
          logo_pos: string
          org_id: string
          supplier: Json
          terms: Json
          updated_at: string
        }
        Insert: {
          brand_color?: string | null
          logo_data?: string | null
          logo_pos?: string
          org_id: string
          supplier?: Json
          terms?: Json
          updated_at?: string
        }
        Update: {
          brand_color?: string | null
          logo_data?: string | null
          logo_pos?: string
          org_id?: string
          supplier?: Json
          terms?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cro_quote_style_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "cro_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      cro_quotes: {
        Row: {
          aaalac: boolean | null
          audit: string | null
          auto: boolean
          billing_at: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          cro_name: string
          cro_org_id: string | null
          cro_quote_no: string | null
          discount: number | null
          discount_reason: string | null
          entry_source: string
          final_report_weeks: number | null
          final_weeks: number | null
          first_submitted_at: string | null
          glp_certs: string[]
          id: string
          includes: string[]
          invite_id: string
          leftover: string | null
          material_by: string
          multisite: string | null
          note: string | null
          other_certs: string | null
          pay_terms: string | null
          pdf_name: string | null
          pdf_path: string | null
          pdf_size: number | null
          quote_date: string | null
          report_draft: string | null
          report_lang: string | null
          retention: string | null
          revision: number
          rfq_id: string
          rfq_no: string
          schedule: string | null
          schedule_steps: Json
          send_conv: string | null
          start_date: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          submitted_ip: unknown
          submitted_ua: string | null
          substance_qty: string | null
          substance_when: string | null
          total_amount: number | null
          total_weeks: number | null
          translation: string | null
          updated_at: string
          valid_until: string | null
          vat: string | null
        }
        Insert: {
          aaalac?: boolean | null
          audit?: string | null
          auto?: boolean
          billing_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          cro_name: string
          cro_org_id?: string | null
          cro_quote_no?: string | null
          discount?: number | null
          discount_reason?: string | null
          entry_source?: string
          final_report_weeks?: number | null
          final_weeks?: number | null
          first_submitted_at?: string | null
          glp_certs?: string[]
          id?: string
          includes?: string[]
          invite_id: string
          leftover?: string | null
          material_by?: string
          multisite?: string | null
          note?: string | null
          other_certs?: string | null
          pay_terms?: string | null
          pdf_name?: string | null
          pdf_path?: string | null
          pdf_size?: number | null
          quote_date?: string | null
          report_draft?: string | null
          report_lang?: string | null
          retention?: string | null
          revision?: number
          rfq_id: string
          rfq_no: string
          schedule?: string | null
          schedule_steps?: Json
          send_conv?: string | null
          start_date?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          submitted_ip?: unknown
          submitted_ua?: string | null
          substance_qty?: string | null
          substance_when?: string | null
          total_amount?: number | null
          total_weeks?: number | null
          translation?: string | null
          updated_at?: string
          valid_until?: string | null
          vat?: string | null
        }
        Update: {
          aaalac?: boolean | null
          audit?: string | null
          auto?: boolean
          billing_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          cro_name?: string
          cro_org_id?: string | null
          cro_quote_no?: string | null
          discount?: number | null
          discount_reason?: string | null
          entry_source?: string
          final_report_weeks?: number | null
          final_weeks?: number | null
          first_submitted_at?: string | null
          glp_certs?: string[]
          id?: string
          includes?: string[]
          invite_id?: string
          leftover?: string | null
          material_by?: string
          multisite?: string | null
          note?: string | null
          other_certs?: string | null
          pay_terms?: string | null
          pdf_name?: string | null
          pdf_path?: string | null
          pdf_size?: number | null
          quote_date?: string | null
          report_draft?: string | null
          report_lang?: string | null
          retention?: string | null
          revision?: number
          rfq_id?: string
          rfq_no?: string
          schedule?: string | null
          schedule_steps?: Json
          send_conv?: string | null
          start_date?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          submitted_ip?: unknown
          submitted_ua?: string | null
          substance_qty?: string | null
          substance_when?: string | null
          total_amount?: number | null
          total_weeks?: number | null
          translation?: string | null
          updated_at?: string
          valid_until?: string | null
          vat?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cro_quotes_cro_org_id_fkey"
            columns: ["cro_org_id"]
            isOneToOne: false
            referencedRelation: "cro_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_quotes_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: true
            referencedRelation: "rfq_invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_quotes_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfq_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      cro_schedule_steps: {
        Row: {
          after_keys: string[]
          id: string
          name: string
          org_id: string
          updated_at: string
          weeks: number | null
        }
        Insert: {
          after_keys?: string[]
          id?: string
          name: string
          org_id: string
          updated_at?: string
          weeks?: number | null
        }
        Update: {
          after_keys?: string[]
          id?: string
          name?: string
          org_id?: string
          updated_at?: string
          weeks?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cro_schedule_steps_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "cro_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      early_signups: {
        Row: {
          ad_agreed_at: string | null
          agreed_at: string
          ask: string | null
          created_at: string
          done_mail_at: string | null
          done_sms_at: string | null
          email: string
          glp: string[]
          id: string
          intent: string | null
          kinds: string[]
          monthly: string | null
          name: string | null
          open_sms_at: string | null
          org: string | null
          org_type: string | null
          phone: string | null
          quote_count: string | null
          role: string
          source: string | null
          timing: string | null
          updated_at: string
          yearly: string | null
        }
        Insert: {
          ad_agreed_at?: string | null
          agreed_at?: string
          ask?: string | null
          created_at?: string
          done_mail_at?: string | null
          done_sms_at?: string | null
          email: string
          glp?: string[]
          id?: string
          intent?: string | null
          kinds?: string[]
          monthly?: string | null
          name?: string | null
          open_sms_at?: string | null
          org?: string | null
          org_type?: string | null
          phone?: string | null
          quote_count?: string | null
          role: string
          source?: string | null
          timing?: string | null
          updated_at?: string
          yearly?: string | null
        }
        Update: {
          ad_agreed_at?: string | null
          agreed_at?: string
          ask?: string | null
          created_at?: string
          done_mail_at?: string | null
          done_sms_at?: string | null
          email?: string
          glp?: string[]
          id?: string
          intent?: string | null
          kinds?: string[]
          monthly?: string | null
          name?: string | null
          open_sms_at?: string | null
          org?: string | null
          org_type?: string | null
          phone?: string | null
          quote_count?: string | null
          role?: string
          source?: string | null
          timing?: string | null
          updated_at?: string
          yearly?: string | null
        }
        Relationships: []
      }
      invite_reminders: {
        Row: {
          invite_id: string
          kind: string
          sent_at: string
        }
        Insert: {
          invite_id: string
          kind: string
          sent_at?: string
        }
        Update: {
          invite_id?: string
          kind?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invite_reminders_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "rfq_invites"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          href: string | null
          id: string
          kind: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          href?: string | null
          id?: string
          kind: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          href?: string | null
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company: string | null
          created_at: string
          cro_org_id: string | null
          dept: string | null
          email: string
          email_notifications: boolean
          id: string
          name: string | null
          org_role: string
          org_type: string | null
          pending_email: string | null
          pending_email_expires_at: string | null
          pending_email_hash: string | null
          pending_org_id: string | null
          phone: string | null
          role: string
          sms_notifications: boolean
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          cro_org_id?: string | null
          dept?: string | null
          email: string
          email_notifications?: boolean
          id: string
          name?: string | null
          org_role?: string
          org_type?: string | null
          pending_email?: string | null
          pending_email_expires_at?: string | null
          pending_email_hash?: string | null
          pending_org_id?: string | null
          phone?: string | null
          role?: string
          sms_notifications?: boolean
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          cro_org_id?: string | null
          dept?: string | null
          email?: string
          email_notifications?: boolean
          id?: string
          name?: string | null
          org_role?: string
          org_type?: string | null
          pending_email?: string | null
          pending_email_expires_at?: string | null
          pending_email_hash?: string | null
          pending_org_id?: string | null
          phone?: string | null
          role?: string
          sms_notifications?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_cro_org_id_fkey"
            columns: ["cro_org_id"]
            isOneToOne: false
            referencedRelation: "cro_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_pending_org_id_fkey"
            columns: ["pending_org_id"]
            isOneToOne: false
            referencedRelation: "cro_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start?: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      rfq_awards: {
        Row: {
          awarded_at: string
          confirmed_auto: boolean
          contract_amount: number | null
          contract_confirm_due_at: string | null
          contract_confirmed_at: string | null
          contract_confirmed_via: string | null
          contract_date: string | null
          contract_gap_reason: string | null
          contract_note: string | null
          contract_reported_at: string | null
          contract_status: string
          cro_name: string
          cro_org_id: string | null
          dispute_resolution: string | null
          dispute_resolution_note: string | null
          dispute_resolved_at: string | null
          dispute_resolved_by: string | null
          fee_basis_amount: number | null
          id: string
          invite_id: string | null
          invite_source: string | null
          quote_id: string
          quote_revision: number | null
          requester_confirmed_at: string | null
          requester_dispute_note: string | null
          requester_disputed_at: string | null
          rfq_id: string
          selected_by: string | null
          sponsor_contract_amount: number | null
          sponsor_contract_date: string | null
          sponsor_contract_note: string | null
          sponsor_contract_status: string | null
          sponsor_reported_at: string | null
          substance_note: string | null
          substance_qty: string | null
          substance_updated_at: string | null
          substance_when: string | null
        }
        Insert: {
          awarded_at?: string
          confirmed_auto?: boolean
          contract_amount?: number | null
          contract_confirm_due_at?: string | null
          contract_confirmed_at?: string | null
          contract_confirmed_via?: string | null
          contract_date?: string | null
          contract_gap_reason?: string | null
          contract_note?: string | null
          contract_reported_at?: string | null
          contract_status?: string
          cro_name: string
          cro_org_id?: string | null
          dispute_resolution?: string | null
          dispute_resolution_note?: string | null
          dispute_resolved_at?: string | null
          dispute_resolved_by?: string | null
          fee_basis_amount?: number | null
          id?: string
          invite_id?: string | null
          invite_source?: string | null
          quote_id: string
          quote_revision?: number | null
          requester_confirmed_at?: string | null
          requester_dispute_note?: string | null
          requester_disputed_at?: string | null
          rfq_id: string
          selected_by?: string | null
          sponsor_contract_amount?: number | null
          sponsor_contract_date?: string | null
          sponsor_contract_note?: string | null
          sponsor_contract_status?: string | null
          sponsor_reported_at?: string | null
          substance_note?: string | null
          substance_qty?: string | null
          substance_updated_at?: string | null
          substance_when?: string | null
        }
        Update: {
          awarded_at?: string
          confirmed_auto?: boolean
          contract_amount?: number | null
          contract_confirm_due_at?: string | null
          contract_confirmed_at?: string | null
          contract_confirmed_via?: string | null
          contract_date?: string | null
          contract_gap_reason?: string | null
          contract_note?: string | null
          contract_reported_at?: string | null
          contract_status?: string
          cro_name?: string
          cro_org_id?: string | null
          dispute_resolution?: string | null
          dispute_resolution_note?: string | null
          dispute_resolved_at?: string | null
          dispute_resolved_by?: string | null
          fee_basis_amount?: number | null
          id?: string
          invite_id?: string | null
          invite_source?: string | null
          quote_id?: string
          quote_revision?: number | null
          requester_confirmed_at?: string | null
          requester_dispute_note?: string | null
          requester_disputed_at?: string | null
          rfq_id?: string
          selected_by?: string | null
          sponsor_contract_amount?: number | null
          sponsor_contract_date?: string | null
          sponsor_contract_note?: string | null
          sponsor_contract_status?: string | null
          sponsor_reported_at?: string | null
          substance_note?: string | null
          substance_qty?: string | null
          substance_updated_at?: string | null
          substance_when?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfq_awards_cro_org_id_fkey"
            columns: ["cro_org_id"]
            isOneToOne: false
            referencedRelation: "cro_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_awards_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "rfq_invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_awards_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "cro_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_awards_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: true
            referencedRelation: "rfq_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_counters: {
        Row: {
          seq: number
          year: number
        }
        Insert: {
          seq?: number
          year: number
        }
        Update: {
          seq?: number
          year?: number
        }
        Relationships: []
      }
      rfq_detail_targets: {
        Row: {
          created_at: string
          cro_org_id: string | null
          id: string
          invite_id: string
          items: Json
          note: string
          quote_id: string
          responded_at: string | null
          responded_by: string | null
          rfq_id: string
          status: string
          total_amount: number | null
          total_weeks: number | null
        }
        Insert: {
          created_at?: string
          cro_org_id?: string | null
          id?: string
          invite_id: string
          items?: Json
          note?: string
          quote_id: string
          responded_at?: string | null
          responded_by?: string | null
          rfq_id: string
          status?: string
          total_amount?: number | null
          total_weeks?: number | null
        }
        Update: {
          created_at?: string
          cro_org_id?: string | null
          id?: string
          invite_id?: string
          items?: Json
          note?: string
          quote_id?: string
          responded_at?: string | null
          responded_by?: string | null
          rfq_id?: string
          status?: string
          total_amount?: number | null
          total_weeks?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rfq_detail_targets_cro_org_id_fkey"
            columns: ["cro_org_id"]
            isOneToOne: false
            referencedRelation: "cro_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_detail_targets_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "rfq_invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_detail_targets_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: true
            referencedRelation: "cro_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_detail_targets_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfq_details"
            referencedColumns: ["rfq_id"]
          },
        ]
      }
      rfq_details: {
        Row: {
          created_at: string
          created_by: string | null
          detail: Json
          note: string
          reply_by: string
          rfq_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          detail?: Json
          note?: string
          reply_by: string
          rfq_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          detail?: Json
          note?: string
          reply_by?: string
          rfq_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfq_details_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: true
            referencedRelation: "rfq_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_events: {
        Row: {
          actor_id: string | null
          body: string | null
          created_at: string
          id: string
          kind: string
          meta: Json
          rfq_id: string
          title: string
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          meta?: Json
          rfq_id: string
          title: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          meta?: Json
          rfq_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfq_events_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfq_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_files: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          rfq_id: string
          scope: string
          size_bytes: number
          storage_path: string
          uploaded_at: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          rfq_id: string
          scope?: string
          size_bytes: number
          storage_path: string
          uploaded_at?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          rfq_id?: string
          scope?: string
          size_bytes?: number
          storage_path?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfq_files_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfq_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_invites: {
        Row: {
          bill_excluded_reason: string | null
          billable: boolean
          cda_reference: string | null
          cda_signed_at: string | null
          created_at: string
          cro_email: string
          cro_name: string
          cro_org_id: string | null
          decline_reason: string | null
          decline_undone_at: string | null
          declined_at: string | null
          expires_at: string
          id: string
          join_actor: string | null
          join_channel: string | null
          join_ip: string | null
          join_terms_version: string | null
          join_ua: string | null
          join_user_id: string | null
          joined_at: string | null
          mailed_at: string | null
          opened_at: string | null
          reply_by: string
          revoked_at: string | null
          rfq_id: string
          rfq_no: string
          sent_at: string
          source: string
          status: string
          token: string
          withdrawn_at: string | null
        }
        Insert: {
          bill_excluded_reason?: string | null
          billable?: boolean
          cda_reference?: string | null
          cda_signed_at?: string | null
          created_at?: string
          cro_email: string
          cro_name: string
          cro_org_id?: string | null
          decline_reason?: string | null
          decline_undone_at?: string | null
          declined_at?: string | null
          expires_at: string
          id?: string
          join_actor?: string | null
          join_channel?: string | null
          join_ip?: string | null
          join_terms_version?: string | null
          join_ua?: string | null
          join_user_id?: string | null
          joined_at?: string | null
          mailed_at?: string | null
          opened_at?: string | null
          reply_by: string
          revoked_at?: string | null
          rfq_id: string
          rfq_no: string
          sent_at?: string
          source?: string
          status?: string
          token?: string
          withdrawn_at?: string | null
        }
        Update: {
          bill_excluded_reason?: string | null
          billable?: boolean
          cda_reference?: string | null
          cda_signed_at?: string | null
          created_at?: string
          cro_email?: string
          cro_name?: string
          cro_org_id?: string | null
          decline_reason?: string | null
          decline_undone_at?: string | null
          declined_at?: string | null
          expires_at?: string
          id?: string
          join_actor?: string | null
          join_channel?: string | null
          join_ip?: string | null
          join_terms_version?: string | null
          join_ua?: string | null
          join_user_id?: string | null
          joined_at?: string | null
          mailed_at?: string | null
          opened_at?: string | null
          reply_by?: string
          revoked_at?: string | null
          rfq_id?: string
          rfq_no?: string
          sent_at?: string
          source?: string
          status?: string
          token?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfq_invites_cro_org_id_fkey"
            columns: ["cro_org_id"]
            isOneToOne: false
            referencedRelation: "cro_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_invites_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfq_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_pending: {
        Row: {
          claimed_at: string | null
          claimed_rfq_no: string | null
          claimed_user: string | null
          created_at: string
          email: string
          expires_at: string
          files: Json
          ip: string | null
          payload: Json
          token: string
          verify_attempts: number
          verify_type: string | null
        }
        Insert: {
          claimed_at?: string | null
          claimed_rfq_no?: string | null
          claimed_user?: string | null
          created_at?: string
          email: string
          expires_at?: string
          files?: Json
          ip?: string | null
          payload: Json
          token: string
          verify_attempts?: number
          verify_type?: string | null
        }
        Update: {
          claimed_at?: string | null
          claimed_rfq_no?: string | null
          claimed_user?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          files?: Json
          ip?: string | null
          payload?: Json
          token?: string
          verify_attempts?: number
          verify_type?: string | null
        }
        Relationships: []
      }
      rfq_requests: {
        Row: {
          admin_note: string | null
          anonymized_at: string | null
          auto_distribute: boolean
          budget: string | null
          categories: string[]
          closed_at: string | null
          company: string
          compare_first_viewed_at: string | null
          compare_last_viewed_at: string | null
          compare_view_count: number
          compared_at: string | null
          confidentiality: string | null
          contact_name: string
          created_at: string
          cro_count: string | null
          distributed_at: string | null
          email: string
          id: string
          intent: string | null
          ip: unknown
          join_by: string | null
          join_by_extended_at: string | null
          nominees_only: boolean
          org_type: string | null
          orphaned_at: string | null
          outcome: string | null
          outcome_at: string | null
          outcome_note: string | null
          payload: Json
          phone: string | null
          purpose: string | null
          reply_by: string | null
          rfq_no: string
          selected_quote_id: string | null
          started_at: string | null
          status: string
          submitted_step: number
          substance: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          admin_note?: string | null
          anonymized_at?: string | null
          auto_distribute?: boolean
          budget?: string | null
          categories?: string[]
          closed_at?: string | null
          company: string
          compare_first_viewed_at?: string | null
          compare_last_viewed_at?: string | null
          compare_view_count?: number
          compared_at?: string | null
          confidentiality?: string | null
          contact_name: string
          created_at?: string
          cro_count?: string | null
          distributed_at?: string | null
          email: string
          id?: string
          intent?: string | null
          ip?: unknown
          join_by?: string | null
          join_by_extended_at?: string | null
          nominees_only?: boolean
          org_type?: string | null
          orphaned_at?: string | null
          outcome?: string | null
          outcome_at?: string | null
          outcome_note?: string | null
          payload: Json
          phone?: string | null
          purpose?: string | null
          reply_by?: string | null
          rfq_no: string
          selected_quote_id?: string | null
          started_at?: string | null
          status?: string
          submitted_step?: number
          substance: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          admin_note?: string | null
          anonymized_at?: string | null
          auto_distribute?: boolean
          budget?: string | null
          categories?: string[]
          closed_at?: string | null
          company?: string
          compare_first_viewed_at?: string | null
          compare_last_viewed_at?: string | null
          compare_view_count?: number
          compared_at?: string | null
          confidentiality?: string | null
          contact_name?: string
          created_at?: string
          cro_count?: string | null
          distributed_at?: string | null
          email?: string
          id?: string
          intent?: string | null
          ip?: unknown
          join_by?: string | null
          join_by_extended_at?: string | null
          nominees_only?: boolean
          org_type?: string | null
          orphaned_at?: string | null
          outcome?: string | null
          outcome_at?: string | null
          outcome_note?: string | null
          payload?: Json
          phone?: string | null
          purpose?: string | null
          reply_by?: string | null
          rfq_no?: string
          selected_quote_id?: string | null
          started_at?: string | null
          status?: string
          submitted_step?: number
          substance?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      sms_log: {
        Row: {
          created_at: string
          dedupe_key: string | null
          id: string
          kind: string
          phone_masked: string
          provider_id: string | null
          reason: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind: string
          phone_masked: string
          provider_id?: string | null
          reason?: string | null
          status: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind?: string
          phone_masked?: string
          provider_id?: string | null
          reason?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_billing_adjustment: {
        Args: {
          p_actor: string
          p_amount: number
          p_corrects: string
          p_month: string
          p_org: string
          p_reason: string
        }
        Returns: Json
      }
      auth_user_confirmed: { Args: { p_user: string }; Returns: boolean }
      auth_user_exists: { Args: { p_user: string }; Returns: boolean }
      auto_confirm_contracts: {
        Args: never
        Returns: {
          award_id: string
          contract_amount: number
          contract_date: string
          cro_name: string
          cro_org_id: string
          rfq_id: string
          rfq_no: string
          user_id: string
        }[]
      }
      award_quote_amount: { Args: { p_award_id: string }; Returns: number }
      billing_adjustment_lines: {
        Args: { p_from: string; p_to: string }
        Returns: {
          adjustment_id: string
          amount: number
          corrects_month: string
          created_at: string
          created_by: string
          month: string
          org_id: string
          org_name: string
          reason: string
        }[]
      }
      billing_awards: {
        Args: { p_from: string; p_to: string }
        Returns: {
          award_id: string
          awarded_at: string
          contract_amount: number
          contract_confirmed_at: string
          contract_confirmed_via: string
          contract_date: string
          contract_reported_at: string
          contract_status: string
          fee: number
          fee_rate: number
          invite_billable: boolean
          invite_joined: boolean
          kind: string
          org_id: string
          org_name: string
          quote_amount: number
          rfq_id: string
          rfq_no: string
        }[]
      }
      billing_invoice_due_days: { Args: never; Returns: number }
      billing_join_paid: {
        Args: { p_channel: string; p_joined_at: string; p_version: string }
        Returns: boolean
      }
      billing_join_pilot: {
        Args: { p_channel: string; p_joined_at: string; p_version: string }
        Returns: boolean
      }
      billing_lines: {
        Args: { p_from: string; p_to: string }
        Returns: {
          auto: boolean
          bill_excluded_reason: string
          billable: boolean
          billing_at: string
          chargeable: boolean
          entry_source: string
          fee_due: number
          first_submitted_at: string
          invite_id: string
          invite_source: string
          join_status: string
          joined_at: string
          managed: boolean
          org_id: string
          org_name: string
          per_request_fee: number
          quote_id: string
          rfq_id: string
          rfq_no: string
          tier: string
          total_amount: number
        }[]
      }
      billing_month_lock: { Args: { p_month: string }; Returns: undefined }
      billing_paid_from: { Args: never; Returns: string }
      billing_pilot_from: { Args: never; Returns: string }
      billing_reference: {
        Args: { p_from: string; p_to: string }
        Returns: {
          org_id: string
          org_name: string
          per_quote_count: number
          per_quote_fee: number
          per_quote_unit: number
          per_quote_unit_source: string
          subscription_count: number
          success_contract_amount: number
          success_count: number
          success_fee: number
          success_rate: number
          success_rate_source: string
        }[]
      }
      billing_reference_per_quote_fee: { Args: never; Returns: number }
      billing_reference_success_rate: { Args: never; Returns: number }
      billing_send_fee: { Args: { p_amount: number }; Returns: number }
      billing_snapshot: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      billing_subscription_fee: { Args: never; Returns: number }
      billing_subscription_max_excl: { Args: never; Returns: number }
      billing_success_fee: { Args: { p_amount: number }; Returns: number }
      billing_success_fee_min: { Args: never; Returns: number }
      billing_success_rate: { Args: { p_amount: number }; Returns: number }
      billing_summary: {
        Args: { p_from: string; p_to: string }
        Returns: {
          billable: number
          declined: number
          delivered: number
          excluded: number
          fee_rate: number
          guidance_count: number
          guidance_fee: number
          managed: boolean
          manual: number
          matched: number
          monthly_fee: number
          no_amount: number
          nominated: number
          org_id: string
          org_name: string
          per_quote: number
          per_quote_fee: number
          per_request_fee: number
          quoted: number
          selected: number
          settled_contract_amount: number
          settled_count: number
          settled_fee: number
          subscription: number
          success_eligible: number
          terms_pending: boolean
          total_due: number
          unanswered: number
        }[]
      }
      billing_tier: { Args: { p_amount: number }; Returns: string }
      billing_vat: { Args: { p_supply: number }; Returns: number }
      business_days_before: {
        Args: { p_day: string; p_n: number }
        Returns: string
      }
      claim_rfqs_by_email: {
        Args: { p_email: string; p_user: string }
        Returns: number
      }
      close_billing_month: {
        Args: { p_actor: string; p_month: string; p_note: string }
        Returns: Json
      }
      compare_readiness: { Args: { p_rfq_id: string }; Returns: Json }
      confirm_contract: {
        Args: { p_actor: string; p_award_id: string }
        Returns: Json
      }
      contract_gap_needs_reason: {
        Args: { p_amount: number; p_quote: number }
        Returns: boolean
      }
      danchu_schema_version: { Args: never; Returns: number }
      dispute_contract: {
        Args: { p_actor: string; p_award_id: string; p_note: string }
        Returns: Json
      }
      issue_billing_invoices: {
        Args: { p_actor: string; p_month: string }
        Returns: Json
      }
      join_offer: {
        Args: {
          p_actor: string
          p_channel: string
          p_invite_id: string
          p_ip: string
          p_terms_version: string
          p_token: string
          p_ua: string
        }
        Returns: Json
      }
      mark_invoice_paid: {
        Args: {
          p_actor: string
          p_id: string
          p_note: string
          p_paid_on: string
        }
        Returns: Json
      }
      mark_invoice_reminded: {
        Args: { p_id: string; p_stage: number }
        Returns: boolean
      }
      mark_invoice_sent: { Args: { p_id: string }; Returns: Json }
      next_rfq_no: { Args: { p_year: number }; Returns: string }
      offer_seat_state: { Args: { p_rfq_id: string }; Returns: Json }
      open_comparison_if_ready: { Args: { p_rfq_id: string }; Returns: Json }
      open_ready_comparisons: {
        Args: never
        Returns: {
          rfq_id: string
          rfq_no: string
          submitted: number
        }[]
      }
      rate_limit_cleanup: { Args: never; Returns: number }
      rate_limit_hit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      record_compare_view: { Args: { p_rfq: string }; Returns: undefined }
      report_contract: {
        Args: {
          p_amount: number
          p_award_id: string
          p_date: string
          p_force?: boolean
          p_gap_reason?: string
          p_note: string
        }
        Returns: Json
      }
      resolve_contract_dispute: {
        Args: {
          p_actor: string
          p_award_id: string
          p_note: string
          p_resolution: string
        }
        Returns: Json
      }
      revoke_invite: {
        Args: { p_invite_id: string; p_reason: string }
        Returns: Json
      }
      rotate_org_invite_tokens: { Args: { p_org: string }; Returns: number }
      save_detail_reply: {
        Args: {
          p_actor: string
          p_body: Json
          p_invite_id: string
          p_token: string
        }
        Returns: Json
      }
      save_quote: {
        Args: {
          p_actor: string
          p_header: Json
          p_invite_id: string
          p_items: Json
          p_submit: boolean
          p_token: string
        }
        Returns: Json
      }
      select_quote: {
        Args: {
          p_quote_id: string
          p_revision: number
          p_rfq_id: string
          p_user: string
        }
        Returns: Json
      }
      send_detail_request: {
        Args: {
          p_detail: Json
          p_note: string
          p_quote_ids: string[]
          p_reply_by: string
          p_rfq_id: string
          p_user: string
        }
        Returns: Json
      }
      set_seat_count: {
        Args: { p_cro_count: string; p_rfq_id: string }
        Returns: Json
      }
      sponsor_report_contract: {
        Args: {
          p_actor: string
          p_amount: number
          p_award_id: string
          p_date: string
          p_note: string
          p_status: string
        }
        Returns: Json
      }
      void_invoice: {
        Args: { p_actor: string; p_id: string; p_reason: string }
        Returns: Json
      }
      withdraw_offer: {
        Args: {
          p_actor: string
          p_invite_id: string
          p_reason: string
          p_token: string
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
