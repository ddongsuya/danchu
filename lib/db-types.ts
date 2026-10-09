/**
 * Supabase 표·함수 타입. supabase/migrations/*.sql 을 손으로 옮긴 것이다 (CLI `supabase gen types` 형식과 같다).
 * 컬럼을 바꾸면 마이그레이션과 이 파일을 함께 고친다. 그러면 `.from().select()` 결과와 insert/update 값이 컴파일에서 검사된다.
 *
 * jsonb 컬럼은 화면이 다루는 모양으로 좁혀 두었다 (payload → Values, design/extra/meta → 객체).
 */
import type { Values } from "./rfq-schema";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Obj = Record<string, unknown>;

/** Row 에서 Insert 를 만든다: 기본값이 있는 컬럼은 선택 */
type Ins<Row, Optional extends keyof Row> = Omit<Row, Optional> & Partial<Pick<Row, Optional>>;

export type Database = {
  public: {
    Tables: {
      rfq_requests: {
        Row: {
          id: string;
          rfq_no: string;
          created_at: string;
          status: string;
          submitted_step: number;
          company: string;
          contact_name: string;
          email: string;
          phone: string | null;
          org_type: string | null;
          purpose: string | null;
          substance: string;
          categories: string[];
          budget: string | null;
          cro_count: string | null;
          confidentiality: string | null;
          reply_by: string | null;
          payload: Values;
          user_agent: string | null;
          ip: string | null;
          user_id: string | null;
          distributed_at: string | null;
          compared_at: string | null;
          selected_quote_id: string | null;
          closed_at: string | null;
          admin_note: string | null;
          intent: string | null;
          outcome: string | null;
          outcome_note: string | null;
          outcome_at: string | null;
          anonymized_at: string | null;
          auto_distribute: boolean;
        };
        Insert: Ins<
          Database["public"]["Tables"]["rfq_requests"]["Row"],
          "id" | "created_at" | "status" | "submitted_step" | "categories" | "phone" | "org_type" | "purpose" | "budget" | "cro_count" | "confidentiality" | "reply_by" | "user_agent" | "ip" | "user_id" | "distributed_at" | "compared_at" | "selected_quote_id" | "closed_at" | "admin_note" | "intent" | "outcome" | "outcome_note" | "outcome_at" | "anonymized_at" | "auto_distribute"
        >;
        Update: Partial<Database["public"]["Tables"]["rfq_requests"]["Row"]>;
        Relationships: [];
      };
      rfq_files: {
        Row: {
          id: string;
          rfq_id: string;
          storage_path: string;
          file_name: string;
          size_bytes: number;
          mime_type: string | null;
          created_at: string;
          uploaded_at: string | null;
        };
        Insert: Ins<Database["public"]["Tables"]["rfq_files"]["Row"], "id" | "created_at" | "mime_type" | "uploaded_at">;
        Update: Partial<Database["public"]["Tables"]["rfq_files"]["Row"]>;
        Relationships: [{ foreignKeyName: "rfq_files_rfq_id_fkey"; columns: ["rfq_id"]; isOneToOne: false; referencedRelation: "rfq_requests"; referencedColumns: ["id"] }];
      };
      rfq_counters: {
        Row: { year: number; seq: number };
        Insert: { year: number; seq?: number };
        Update: { year?: number; seq?: number };
        Relationships: [];
      };
      rfq_invites: {
        Row: {
          id: string;
          rfq_id: string;
          rfq_no: string;
          cro_name: string;
          cro_email: string;
          token: string;
          reply_by: string;
          expires_at: string;
          status: string;
          sent_at: string;
          opened_at: string | null;
          created_at: string;
          cro_org_id: string | null;
          declined_at: string | null;
          decline_reason: string | null;
          cda_signed_at: string | null;
          cda_reference: string | null;
          source: string;
          billable: boolean;
          bill_excluded_reason: string | null;
        };
        Insert: Ins<Database["public"]["Tables"]["rfq_invites"]["Row"], "id" | "token" | "status" | "sent_at" | "opened_at" | "created_at" | "cro_org_id" | "declined_at" | "decline_reason" | "cda_signed_at" | "cda_reference" | "source" | "billable" | "bill_excluded_reason">;
        Update: Partial<Database["public"]["Tables"]["rfq_invites"]["Row"]>;
        Relationships: [
          { foreignKeyName: "rfq_invites_rfq_id_fkey"; columns: ["rfq_id"]; isOneToOne: false; referencedRelation: "rfq_requests"; referencedColumns: ["id"] },
          { foreignKeyName: "rfq_invites_cro_org_id_fkey"; columns: ["cro_org_id"]; isOneToOne: false; referencedRelation: "cro_orgs"; referencedColumns: ["id"] },
        ];
      };
      cro_quotes: {
        Row: {
          id: string;
          invite_id: string;
          rfq_id: string;
          rfq_no: string;
          cro_name: string;
          contact_name: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          cro_quote_no: string | null;
          quote_date: string | null;
          valid_until: string | null;
          glp_certs: string[];
          aaalac: boolean | null;
          other_certs: string | null;
          total_amount: number | null;
          discount: number | null;
          discount_reason: string | null;
          vat: string | null;
          pay_terms: string | null;
          start_date: string | null;
          total_weeks: number | null;
          schedule: string | null;
          report_draft: string | null;
          report_lang: string | null;
          translation: string | null;
          substance_qty: string | null;
          substance_when: string | null;
          retention: string | null;
          leftover: string | null;
          send_conv: string | null;
          multisite: string | null;
          audit: string | null;
          note: string | null;
          pdf_path: string | null;
          pdf_name: string | null;
          pdf_size: number | null;
          status: string;
          submitted_at: string | null;
          created_at: string;
          updated_at: string;
          cro_org_id: string | null;
          submitted_by: string | null;
          submitted_ip: string | null;
          submitted_ua: string | null;
          includes: string[];
          auto: boolean;
          material_by: string;
        };
        Insert: Ins<
          Database["public"]["Tables"]["cro_quotes"]["Row"],
          Exclude<keyof Database["public"]["Tables"]["cro_quotes"]["Row"], "invite_id" | "rfq_id" | "rfq_no" | "cro_name">
        >;
        Update: Partial<Database["public"]["Tables"]["cro_quotes"]["Row"]>;
        Relationships: [
          { foreignKeyName: "cro_quotes_invite_id_fkey"; columns: ["invite_id"]; isOneToOne: true; referencedRelation: "rfq_invites"; referencedColumns: ["id"] },
          { foreignKeyName: "cro_quotes_rfq_id_fkey"; columns: ["rfq_id"]; isOneToOne: false; referencedRelation: "rfq_requests"; referencedColumns: ["id"] },
          { foreignKeyName: "cro_quotes_cro_org_id_fkey"; columns: ["cro_org_id"]; isOneToOne: false; referencedRelation: "cro_orgs"; referencedColumns: ["id"] },
        ];
      };
      cro_quote_items: {
        Row: {
          id: string;
          quote_id: string;
          seq: number;
          category: string;
          name: string;
          cond: string | null;
          avail: string | null;
          amount: number | null;
          weeks: number | null;
          reason: string | null;
          start_date: string | null;
          glp: string | null;
          species: string | null;
          groups: number | null;
          per_group: string | null;
          dosing: string | null;
          route: string | null;
          includes: string[];
          options: Json;
          excluded: string | null;
          note: string | null;
          design: Obj;
          source: string | null;
          unit: string;
          unit_price: number | null;
          sample_count: number | null;
        };
        Insert: Ins<Database["public"]["Tables"]["cro_quote_items"]["Row"], Exclude<keyof Database["public"]["Tables"]["cro_quote_items"]["Row"], "quote_id" | "seq" | "category" | "name">>;
        Update: Partial<Database["public"]["Tables"]["cro_quote_items"]["Row"]>;
        Relationships: [{ foreignKeyName: "cro_quote_items_quote_id_fkey"; columns: ["quote_id"]; isOneToOne: false; referencedRelation: "cro_quotes"; referencedColumns: ["id"] }];
      };
      cro_quote_addons: {
        Row: { id: string; quote_id: string; seq: number; name: string; reason: string | null; amount: number | null; weeks: number | null; level: string | null };
        Insert: Ins<Database["public"]["Tables"]["cro_quote_addons"]["Row"], "id" | "reason" | "amount" | "weeks" | "level">;
        Update: Partial<Database["public"]["Tables"]["cro_quote_addons"]["Row"]>;
        Relationships: [{ foreignKeyName: "cro_quote_addons_quote_id_fkey"; columns: ["quote_id"]; isOneToOne: false; referencedRelation: "cro_quotes"; referencedColumns: ["id"] }];
      };
      rfq_awards: {
        Row: {
          id: string;
          rfq_id: string;
          quote_id: string;
          cro_name: string;
          awarded_at: string;
          contract_date: string | null;
          contract_amount: number | null;
          invite_id: string | null;
          cro_org_id: string | null;
          selected_by: string | null;
          contract_reported_at: string | null;
          contract_note: string | null;
          fee_basis_amount: number | null;
          invite_source: string | null;
        };
        Insert: Ins<Database["public"]["Tables"]["rfq_awards"]["Row"], "id" | "awarded_at" | "contract_date" | "contract_amount" | "invite_id" | "cro_org_id" | "selected_by" | "contract_reported_at" | "contract_note" | "fee_basis_amount" | "invite_source">;
        Update: Partial<Database["public"]["Tables"]["rfq_awards"]["Row"]>;
        Relationships: [
          { foreignKeyName: "rfq_awards_rfq_id_fkey"; columns: ["rfq_id"]; isOneToOne: true; referencedRelation: "rfq_requests"; referencedColumns: ["id"] },
          { foreignKeyName: "rfq_awards_quote_id_fkey"; columns: ["quote_id"]; isOneToOne: false; referencedRelation: "cro_quotes"; referencedColumns: ["id"] },
        ];
      };
      cro_orgs: {
        Row: {
          id: string;
          name: string;
          status: string;
          business_no: string | null;
          website: string | null;
          address: string | null;
          contact_name: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          glp_certs: string[];
          aaalac: boolean | null;
          other_certs: string | null;
          categories: string[];
          intro: string | null;
          created_at: string;
          approved_at: string | null;
          updated_at: string;
          auto_reply: boolean;
          monthly_cap: number | null;
          per_request_fee: number | null;
        };
        Insert: Ins<Database["public"]["Tables"]["cro_orgs"]["Row"], Exclude<keyof Database["public"]["Tables"]["cro_orgs"]["Row"], "name">>;
        Update: Partial<Database["public"]["Tables"]["cro_orgs"]["Row"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          role: string;
          name: string | null;
          company: string | null;
          dept: string | null;
          phone: string | null;
          org_type: string | null;
          cro_org_id: string | null;
          created_at: string;
          updated_at: string;
          pending_org_id: string | null;
          email_notifications: boolean;
          org_role: string;
        };
        Insert: Ins<Database["public"]["Tables"]["profiles"]["Row"], "role" | "name" | "company" | "dept" | "phone" | "org_type" | "cro_org_id" | "created_at" | "updated_at" | "pending_org_id" | "email_notifications" | "org_role">;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [
          { foreignKeyName: "profiles_cro_org_id_fkey"; columns: ["cro_org_id"]; isOneToOne: false; referencedRelation: "cro_orgs"; referencedColumns: ["id"] },
          { foreignKeyName: "profiles_pending_org_id_fkey"; columns: ["pending_org_id"]; isOneToOne: false; referencedRelation: "cro_orgs"; referencedColumns: ["id"] },
        ];
      };
      rfq_events: {
        Row: { id: string; rfq_id: string; kind: string; title: string; body: string | null; actor_id: string | null; meta: Obj; created_at: string };
        Insert: Ins<Database["public"]["Tables"]["rfq_events"]["Row"], "id" | "body" | "actor_id" | "meta" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["rfq_events"]["Row"]>;
        Relationships: [{ foreignKeyName: "rfq_events_rfq_id_fkey"; columns: ["rfq_id"]; isOneToOne: false; referencedRelation: "rfq_requests"; referencedColumns: ["id"] }];
      };
      notifications: {
        Row: { id: string; user_id: string; kind: string; title: string; body: string | null; href: string | null; read_at: string | null; created_at: string };
        Insert: Ins<Database["public"]["Tables"]["notifications"]["Row"], "id" | "body" | "href" | "read_at" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["notifications"]["Row"]>;
        Relationships: [];
      };
      cro_catalog: {
        Row: {
          id: string;
          org_id: string;
          item_key: string;
          category: string;
          item: string;
          available: boolean;
          glp: string;
          species: string[];
          groups_ctrl: number | null;
          groups_test: number | null;
          per_sex: number | null;
          recovery_weeks: number | null;
          recovery_per_sex: number | null;
          route: string | null;
          dosing: string | null;
          weeks: number | null;
          includes: string[];
          options: Json;
          unit: string;
          price_min: number | null;
          price_max: number | null;
          extra: Obj;
          note: string | null;
          last_amount: number | null;
          last_weeks: number | null;
          last_quoted_at: string | null;
          source: string;
          created_at: string;
          updated_at: string;
          method: string | null;
          sort: number;
        };
        Insert: Ins<Database["public"]["Tables"]["cro_catalog"]["Row"], Exclude<keyof Database["public"]["Tables"]["cro_catalog"]["Row"], "org_id" | "item_key" | "category" | "item">>;
        Update: Partial<Database["public"]["Tables"]["cro_catalog"]["Row"]>;
        Relationships: [{ foreignKeyName: "cro_catalog_org_id_fkey"; columns: ["org_id"]; isOneToOne: false; referencedRelation: "cro_orgs"; referencedColumns: ["id"] }];
      };
      cro_org_presets: {
        Row: { org_id: string; preset_key: string; offered: boolean; package_price: number | null; note: string | null; updated_at: string };
        Insert: Ins<Database["public"]["Tables"]["cro_org_presets"]["Row"], "offered" | "package_price" | "note" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["cro_org_presets"]["Row"]>;
        Relationships: [{ foreignKeyName: "cro_org_presets_org_id_fkey"; columns: ["org_id"]; isOneToOne: false; referencedRelation: "cro_orgs"; referencedColumns: ["id"] }];
      };
      invite_reminders: {
        Row: { invite_id: string; kind: string; sent_at: string };
        Insert: { invite_id: string; kind: string; sent_at?: string };
        Update: Partial<Database["public"]["Tables"]["invite_reminders"]["Row"]>;
        Relationships: [{ foreignKeyName: "invite_reminders_invite_id_fkey"; columns: ["invite_id"]; isOneToOne: false; referencedRelation: "rfq_invites"; referencedColumns: ["id"] }];
      };
      rate_limits: {
        Row: { key: string; window_start: string; count: number };
        Insert: { key: string; window_start?: string; count?: number };
        Update: Partial<Database["public"]["Tables"]["rate_limits"]["Row"]>;
        Relationships: [];
      };
      admin_audit: {
        Row: {
          id: string;
          created_at: string;
          actor_id: string | null;
          actor_email: string | null;
          action: string;
          target_type: string;
          target_id: string | null;
          target_label: string | null;
          before: Record<string, unknown> | null;
          after: Record<string, unknown> | null;
          note: string | null;
        };
        Insert: Ins<Database["public"]["Tables"]["admin_audit"]["Row"], "id" | "created_at" | "actor_id" | "actor_email" | "target_id" | "target_label" | "before" | "after" | "note">;
        Update: Partial<Database["public"]["Tables"]["admin_audit"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      next_rfq_no: { Args: { p_year: number }; Returns: string };
      claim_rfqs_by_email: { Args: { p_user: string; p_email: string }; Returns: number };
      rate_limit_hit: { Args: { p_key: string; p_limit: number; p_window_seconds: number }; Returns: boolean };
      rate_limit_cleanup: { Args: Record<string, never>; Returns: number };
      rotate_org_invite_tokens: { Args: { p_org: string }; Returns: number };
      select_quote: { Args: { p_rfq_id: string; p_quote_id: string; p_user: string }; Returns: Json };
      save_quote: { Args: { p_invite_id: string; p_header: Json; p_items: Json; p_submit: boolean; p_actor: string | null }; Returns: Json };
      report_contract: { Args: { p_award_id: string; p_date: string; p_amount: number; p_note: string }; Returns: Json };
      billing_summary: { Args: { p_from: string; p_to: string }; Returns: BillingSummaryRow[] };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];

/** billing_summary() 한 행: 기간 내 기관별 전달·회신·선정 집계 */
export type BillingSummaryRow = {
  org_id: string;
  org_name: string;
  per_request_fee: number | null;
  monthly_cap: number | null;
  delivered: number;
  billable: number;
  excluded: number;
  matched: number;
  nominated: number;
  manual: number;
  replied: number;
  declined: number;
  unanswered: number;
  selected: number;
  selected_amount: number;
};
