/**
 * Supabase 표·함수 타입. supabase/migrations/*.sql 을 손으로 옮긴 것이다 (CLI `supabase gen types` 형식과 같다).
 * 컬럼을 바꾸면 마이그레이션과 이 파일을 함께 고친다. 그러면 `.from().select()` 결과와 insert/update 값이 컴파일에서 검사된다.
 *
 * jsonb 컬럼은 화면이 다루는 모양으로 좁혀 두었다 (payload → Values, design/extra/meta → 객체).
 */
import type { Values } from "./rfq-schema";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Obj = Record<string, unknown>;

/** cro_quotes.entry_source */
export type QuoteEntrySource = "cro" | "operator";
/** rfq_awards.contract_status */
export type ContractStatus = "pending" | "negotiating" | "signed" | "not_signed";

/** rfq_invites.join_channel (0023) */
export type JoinChannel = "portal" | "token" | "legacy";
/** 참여 기록 열 (0023). join_offer()·withdraw_offer() 만 쓴다 */
type InviteJoinColumn = "joined_at" | "join_actor" | "join_channel" | "join_user_id" | "join_terms_version" | "join_ip" | "join_ua" | "withdrawn_at" | "decline_undone_at";
/** 계약 확인 열 (0025). confirm_contract·dispute_contract·resolve_contract_dispute·auto_confirm_contracts·report_contract 만 쓴다 */
type ContractConfirmColumn =
  | "requester_confirmed_at" | "confirmed_auto" | "requester_disputed_at" | "requester_dispute_note"
  | "contract_confirm_due_at" | "contract_confirmed_at" | "contract_confirmed_via"
  | "dispute_resolved_at" | "dispute_resolved_by" | "dispute_resolution" | "dispute_resolution_note";
/** 계약 확인 경로 (0025). sponsor 의뢰자 · auto 7일 뒤 자동 · operator 이의 정리 뒤 운영자 · legacy 0025 전 보고 */
export type ContractConfirmVia = "sponsor" | "auto" | "operator" | "legacy";
/** billing_lines().join_status (0023). joined 만 청구한다 */
export type JoinStatus = "joined" | "legacy" | "not_joined" | "pilot";

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
          /** 비교표가 열린 시각 (0025). 한 번 채우면 비우거나 바꿀 수 없고, 그 뒤에는 reply_by 도 바꿀 수 없다 (0026 트리거 rfq_requests_compare_lock) */
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
          /** 계정이 지워져 user_id 가 비워진 시각 (0021). 채워진 요청은 같은 이메일 계정에 다시 연결하지 않는다 */
          orphaned_at: string | null;
          /** 참여 결정 기한 (0023). 이때까지 결정하지 않은 지명 기관 수만큼 자리를 비워 둔다 */
          join_by: string | null;
          /** 지명 기관에만 안내 (0023). 켜져 있으면 자동 매칭 안내(source = matched)를 DB 가 거절한다 */
          nominees_only: boolean;
          /** 운영자가 참여 결정 기한을 늘린 시각 (0023). 연장은 한 번만 */
          join_by_extended_at: string | null;
          /** 참여 안내와 접수 메일을 시작한 시각 (0025). 첨부 업로드가 끝난 뒤 startRfq 가 한 번만 채운다. 비어 있으면 아직 안내하지 않았다 */
          started_at: string | null;
          /** 의뢰자가 열린 비교표를 처음 연 시각 (0028). 운영자가 연 것은 세지 않는다 */
          compare_first_viewed_at: string | null;
          /** 의뢰자가 열린 비교표를 마지막으로 연 시각 (0028) */
          compare_last_viewed_at: string | null;
          /** 의뢰자가 열린 비교표를 연 횟수 (0028) */
          compare_view_count: number;
        };
        Insert: Ins<
          Database["public"]["Tables"]["rfq_requests"]["Row"],
          "id" | "created_at" | "status" | "submitted_step" | "categories" | "phone" | "org_type" | "purpose" | "budget" | "cro_count" | "confidentiality" | "reply_by" | "user_agent" | "ip" | "user_id" | "distributed_at" | "compared_at" | "selected_quote_id" | "closed_at" | "admin_note" | "intent" | "outcome" | "outcome_note" | "outcome_at" | "anonymized_at" | "auto_distribute" | "orphaned_at" | "join_by" | "nominees_only" | "join_by_extended_at" | "started_at" | "compare_first_viewed_at" | "compare_last_viewed_at" | "compare_view_count"
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
          mailed_at: string | null;
          /** 운영자가 초대를 거둔 시각 (0021). 채워지면 지울 수 없고 회신 화면·저장·첨부·PDF 모두 거절 */
          revoked_at: string | null;
          /** 기관이 참여하기를 누른 시각 (0023). 비어 있으면 참여 결정 전. join_offer() 로만 채우고 바꿀 수 없다. 견적 저장·청구의 조건 */
          joined_at: string | null;
          /** 참여를 누른 주체 (0023). member 로그인한 담당자 · token:<링크 지문> · legacy */
          join_actor: string | null;
          /** 참여 경로 (0023). legacy 는 0023 전 작성 중·제출 초대이며 청구하지 않는다 */
          join_channel: JoinChannel | null;
          /** 참여를 누른 담당자 계정 (0023). 링크만으로 누르면 null */
          join_user_id: string | null;
          /** 참여할 때 보여 준 이용 조건 판 (0023) */
          join_terms_version: string | null;
          join_ip: string | null;
          join_ua: string | null;
          /** 참여 뒤 제출 전 철회한 시각 (0023). 상태는 declined. 되돌릴 수 없다 */
          withdrawn_at: string | null;
          /** 참여 전 불참을 되돌려 다시 참여한 시각 (0025). join_offer 만 채운다. declined_at·decline_reason 은 앞선 불참 기록으로 남는다 */
          decline_undone_at: string | null;
        };
        /** 참여 기록(join_*·joined_at·withdrawn_at)은 DB 함수만 쓴다 (0023 트리거). 직접 넣거나 바꾸면 거절된다 */
        Insert: Ins<Omit<Database["public"]["Tables"]["rfq_invites"]["Row"], InviteJoinColumn>, "id" | "token" | "status" | "sent_at" | "opened_at" | "created_at" | "cro_org_id" | "declined_at" | "decline_reason" | "cda_signed_at" | "cda_reference" | "source" | "billable" | "bill_excluded_reason" | "mailed_at" | "revoked_at">;
        // 참여 기록은 앱이 바꾸지 못한다. 접속 기록(join_ip·join_ua)만 보존 기간 뒤 비울 수 있다 (lib/retention.ts, DB 트리거가 90일 경과를 확인)
        Update: Partial<Omit<Database["public"]["Tables"]["rfq_invites"]["Row"], InviteJoinColumn>> & { join_ip?: null; join_ua?: null };
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
          /** 처음 제출 시각 (0020). 한 번 채우면 트리거가 고정한다. 건당 이용료의 청구 월 기준 */
          first_submitted_at: string | null;
          /** 청구 기준 시각 (0020). 금액이 있는 상태로 처음 제출된 시각. 한 번 채우면 고정. 건당 이용료의 청구 월 */
          billing_at: string | null;
          created_at: string;
          updated_at: string;
          cro_org_id: string | null;
          submitted_by: string | null;
          submitted_ip: string | null;
          submitted_ua: string | null;
          includes: string[];
          auto: boolean;
          material_by: string;
          /** 입력 주체: cro 기관 / operator 운영자가 기관 PDF 를 보고 대리 입력 (0019) */
          entry_source: QuoteEntrySource;
          /** 견적 판 (0022). 내용이 바뀔 때마다 트리거가 올린다. 선정 확인 화면이 본 판을 select_quote 에 넘긴다 */
          revision: number;
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
          /** 계약 진행 상태. signed 는 체결 보고(contract_reported_at)와 항상 함께 있다 (0019) */
          contract_status: ContractStatus;
          /** 선정할 때 의뢰자가 확인한 견적 판 (0022). 0022 전 선정은 null */
          quote_revision: number | null;
          /** 의뢰자가 계약 보고를 확인한 시각 (0025). 7일 뒤 자동 확정도 이 칸을 채우고 confirmed_auto 를 켠다 */
          requester_confirmed_at: string | null;
          confirmed_auto: boolean;
          /** 의뢰자 이의 (0025). 운영자가 정리할 때까지 정산하지 않는다 */
          requester_disputed_at: string | null;
          requester_dispute_note: string | null;
          /** 자동 확정 예정 시각 (0025). 보고(또는 확인 전 정정) + 7일 */
          contract_confirm_due_at: string | null;
          /** 계약이 확인된 시각 (0025). 성사수수료 정산 월의 기준 (서울) */
          contract_confirmed_at: string | null;
          contract_confirmed_via: ContractConfirmVia | null;
          /** 운영자가 이의를 정리한 시각·사람·결과 (0025) */
          dispute_resolved_at: string | null;
          dispute_resolved_by: string | null;
          dispute_resolution: "confirm" | "reject" | null;
          dispute_resolution_note: string | null;
          /** 선정된 기관이 적는 시험물질 필요량·보낼 시점·메모 (0027) */
          substance_qty: string | null;
          substance_when: string | null;
          substance_note: string | null;
          substance_updated_at: string | null;
        };
        /** 확인·이의 열(ContractConfirmColumn)은 DB 함수만 쓴다 (0025 트리거) */
        Insert: Ins<Omit<Database["public"]["Tables"]["rfq_awards"]["Row"], ContractConfirmColumn>, "id" | "awarded_at" | "contract_date" | "contract_amount" | "invite_id" | "cro_org_id" | "selected_by" | "contract_reported_at" | "contract_note" | "fee_basis_amount" | "invite_source" | "contract_status" | "quote_revision" | "substance_qty" | "substance_when" | "substance_note" | "substance_updated_at">;
        Update: Partial<Omit<Database["public"]["Tables"]["rfq_awards"]["Row"], ContractConfirmColumn>>;
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
          /** 건당 이용료 (원). 1,000만 원 이상 견적 1건마다. null 이면 미정 (0020) */
          per_request_fee: number | null;
          /** 성사수수료율 (0.03 = 3%). null 이면 미정 */
          fee_rate: number | null;
          /** 월 구독료 (원). null 이면 구독하지 않음 (0020) */
          monthly_fee: number | null;
          /** 구독 시작 월 (그 달 1일, 0020). 이 달부터 명세에 월 구독료가 나온다. 비워 저장하면 구독료를 적은 달 */
          monthly_fee_from: string | null;
          /** 운영자가 등록·관리하는 기관 (담당자 계정 없음, 메일 링크는 /q 토큰) (0019) */
          managed: boolean;
          /** 생성 컬럼: 사업자번호 숫자만. insert/update 에 넣지 않는다 */
          business_no_norm: string | null;
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
          pending_email: string | null;
          pending_email_hash: string | null;
          pending_email_expires_at: string | null;
        };
        Insert: Ins<Database["public"]["Tables"]["profiles"]["Row"], "role" | "name" | "company" | "dept" | "phone" | "org_type" | "cro_org_id" | "created_at" | "updated_at" | "pending_org_id" | "email_notifications" | "org_role" | "pending_email" | "pending_email_hash" | "pending_email_expires_at">;
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
      billing_periods: {
        /** snapshot: 마감 때 저장한 그 달 명세 (0020) */
        Row: { month: string; closed_at: string; closed_by: string | null; note: string | null; snapshot: BillingSnapshot | null };
        Insert: Ins<Database["public"]["Tables"]["billing_periods"]["Row"], "closed_at" | "closed_by" | "note" | "snapshot">;
        Update: Partial<Database["public"]["Tables"]["billing_periods"]["Row"]>;
        Relationships: [];
      };
      billing_adjustments: {
        /** 청구 조정 항목 (0024). 마감한 달에는 넣을 수 없고, 그 달을 마감하면 바꾸거나 지울 수 없다 (트리거) */
        Row: { id: string; org_id: string; month: string; amount: number; reason: string; corrects_month: string | null; created_by: string | null; created_at: string };
        Insert: Ins<Database["public"]["Tables"]["billing_adjustments"]["Row"], "id" | "corrects_month" | "created_by" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["billing_adjustments"]["Row"]>;
        Relationships: [];
      };
      /** 보내기 직전 가입용 임시 요청서 (0025). 서비스 키로만 읽고 쓴다 (anon·authenticated 권한 없음). 7일 뒤 예약 작업이 정리한다 */
      rfq_pending: {
        Row: {
          token: string;
          email: string;
          payload: Values;
          files: { name: string; size: number; type: string; path: string }[];
          created_at: string;
          expires_at: string;
          verify_attempts: number;
          verify_type: string | null;
          claimed_at: string | null;
          claimed_rfq_no: string | null;
          claimed_user: string | null;
          ip: string | null;
        };
        Insert: Ins<Database["public"]["Tables"]["rfq_pending"]["Row"], "files" | "created_at" | "expires_at" | "verify_attempts" | "verify_type" | "claimed_at" | "claimed_rfq_no" | "claimed_user" | "ip">;
        Update: Partial<Database["public"]["Tables"]["rfq_pending"]["Row"]>;
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
      /** 0022: p_revision 은 선정 확인 화면이 본 견적 판. 지금 판과 다르면 { ok: false, code: 'quote_changed', revision }. 0025: 비교표가 열리기 전이면 code 'not_compared' */
      select_quote: { Args: { p_rfq_id: string; p_quote_id: string; p_user: string; p_revision: number }; Returns: Json };
      /** 0022: 마지막으로 적용한 마이그레이션 번호 (lib/schema-version.ts) */
      danchu_schema_version: { Args: Record<string, never>; Returns: number };
      /** 0028: 의뢰자가 열린 비교표를 연 기록. 비교표가 열리지 않은 요청에는 아무것도 하지 않는다 */
      record_compare_view: { Args: { p_rfq: string }; Returns: undefined };
      /** 0023: 기관 참여. { ok, already?, joined_at, channel, seats } 또는 { ok: false, code }. 0025: 참여 전 불참은 참여 결정 기한 전·자리가 있으면 다시 참여(rejoined: true), 지나면 code declined */
      join_offer: { Args: { p_invite_id: string; p_token: string; p_actor: string | null; p_channel: "portal" | "token"; p_terms_version: string; p_ip: string | null; p_ua: string | null }; Returns: Json };
      /** 0023: 참여 철회 (제출 전만, 되돌릴 수 없다). { ok, already?, seats } 또는 { ok: false, code }. 0025: 남은 참여 기관이 모두 냈으면 compare_opened: true */
      withdraw_offer: { Args: { p_invite_id: string; p_token: string; p_actor: string | null; p_reason: string | null }; Returns: Json };
      /** 0023: 요청의 자리 현황 */
      offer_seat_state: { Args: { p_rfq_id: string }; Returns: Json };
      set_seat_count: { Args: { p_rfq_id: string; p_cro_count: string }; Returns: Json };
      /** 0021: p_token 은 화면을 연 링크의 토큰. 잠금 뒤 지금 토큰·철회·만료·기관 상태·소속을 다시 본다. 0023: 참여 전이면 not_joined.
       *  0025: 제출로 참여 기관이 모두 냈고 더 참여할 수 없으면 같은 트랜잭션에서 비교표를 열고 compare_opened: true */
      save_quote: { Args: { p_invite_id: string; p_header: Json; p_items: Json; p_submit: boolean; p_actor: string | null; p_token: string }; Returns: Json };
      /** 0021: 운영자 초대 취소 (철회 표식 + 토큰 재발급). { ok, already?, status } 또는 { ok: false, code } */
      revoke_invite: { Args: { p_invite_id: string; p_reason: string | null }; Returns: Json };
      /** 0025: 첫 보고면 confirm_due_at(+7일)을 잡고, 확인 전 정정이면 다시 잡는다. { ok, rfq_id, rfq_no, user_id, substance, corrected, confirm_due_at } */
      report_contract: { Args: { p_award_id: string; p_date: string; p_amount: number; p_note: string; p_force?: boolean }; Returns: Json };
      /** 0025: 의뢰자(요청 주인) 또는 운영자가 계약 보고를 확인. { ok, already?, rfq_id, rfq_no, cro_org_id, contract_amount, contract_date } 또는 { ok: false, code: not_found·forbidden·not_reported·disputed } */
      confirm_contract: { Args: { p_award_id: string; p_actor: string }; Returns: Json };
      /** 0025: 의뢰자 이의. 정산을 멈춘다. { ok, already?, ... } 또는 { ok: false, code: not_found·forbidden·not_reported·confirmed·note } */
      dispute_contract: { Args: { p_award_id: string; p_actor: string; p_note: string }; Returns: Json };
      /** 0025: 운영자가 이의를 정리 (confirm 보고대로 확정 · reject 보고 취소, 기관이 다시 보고). 감사 기록. { ok, ... } 또는 { ok: false, code: not_found·forbidden·no_dispute·bad_resolution·note } */
      resolve_contract_dispute: { Args: { p_award_id: string; p_actor: string; p_resolution: "confirm" | "reject"; p_note: string }; Returns: Json };
      /** 0025: 확인 기한(보고 + 7일)이 지난 미확인·이의 없는 계약을 확정. 확정한 행 */
      auto_confirm_contracts: { Args: Record<string, never>; Returns: { award_id: string; rfq_id: string; rfq_no: string; user_id: string | null; cro_org_id: string | null; cro_name: string; contract_amount: number; contract_date: string }[] };
      /** 0025: 참여한 기관이 모두 제출했고 더 참여할 수 없으면 비교표를 연다 (요청 행 잠금). { ok, opened, submitted, joined, reason? } */
      open_comparison_if_ready: { Args: { p_rfq_id: string }; Returns: Json };
      /** 0025: 참여 결정 기한이 지나 열 수 있게 된 요청을 모두 연다 (예약 작업). 연 요청 */
      open_ready_comparisons: { Args: Record<string, never>; Returns: { rfq_id: string; rfq_no: string; submitted: number }[] };
      /** 0025: 요청의 비교표 공개 조건 현황 (화면 표시용) */
      compare_readiness: { Args: { p_rfq_id: string }; Returns: Json };
      billing_summary: { Args: { p_from: string; p_to: string }; Returns: BillingSummaryRow[] };
      billing_lines: { Args: { p_from: string; p_to: string }; Returns: BillingLineRow[] };
      billing_awards: { Args: { p_from: string; p_to: string }; Returns: BillingAwardRow[] };
      billing_snapshot: { Args: { p_from: string; p_to: string }; Returns: BillingSnapshot };
      /** 0024: 한 번만 마감한다. { ok, month, orgs } · 이미 마감했으면 { ok, already } · 끝나지 않은 달이면 { ok: false, code: 'not_ended' } */
      close_billing_month: { Args: { p_month: string; p_actor: string | null; p_note: string }; Returns: Json };
      /** 0024: 조정 항목 넣기. { ok, id, month, org_name } 또는 { ok: false, code: bad_month·amount·reason·not_found·closed·corrects } */
      add_billing_adjustment: { Args: { p_org: string; p_month: string; p_amount: number; p_reason: string; p_corrects: string | null; p_actor: string | null }; Returns: Json };
      /** 0024: 그 기간의 조정 항목 (적용 월 기준) */
      billing_adjustment_lines: { Args: { p_from: string; p_to: string }; Returns: BillingAdjustmentRow[] };
      /** 0024: 시범 기간 참고 수치. 합계에 넣지 않는다 */
      billing_reference: { Args: { p_from: string; p_to: string }; Returns: BillingReferenceRow[] };
      billing_tier: { Args: { p_amount: number | null }; Returns: string };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];

/** billing_summary() 한 행: 그 달 기관별 명세 (0020). 금액 열의 null 은 단가·요율 미정이다 (0 이 아니다) */
export type BillingSummaryRow = {
  org_id: string;
  org_name: string;
  /** 운영자 관리 기관 */
  managed: boolean;
  per_request_fee: number | null;
  fee_rate: number | null;
  /** 월 구독료. 승인된 기관만, null 이면 구독하지 않음 */
  monthly_fee: number | null;
  /** 그 달에 보낸 초대 (운영 지표, 청구와 무관) */
  delivered: number;
  matched: number;
  nominated: number;
  manual: number;
  declined: number;
  unanswered: number;
  /** 그 달에 처음 제출된 견적 */
  quoted: number;
  /** 청구 대상 견적 (참여 기록이 있고, 제외되지 않았고, 금액이 있는 것. 0023) */
  billable: number;
  /** 청구하지 않는 견적: 운영자 제외 + 참여 기록 없음 + 참여 기능 전(legacy) 견적 (0023) */
  excluded: number;
  /** 금액 미입력 견적 (아직 청구하지 않음) */
  no_amount: number;
  /** 1,000만 원 미만 (구독) */
  subscription: number;
  /** 건당 이용료 대상 (1,000만 원 이상) */
  per_quote: number;
  /** 그중 5,000만 원 이상 */
  success_eligible: number;
  /** 건당 이용료 합계. 대상이 있는데 단가 미정이면 null */
  per_quote_fee: number | null;
  /** 이 달 제출 견적 중 선정된 수 */
  selected: number;
  /** 성사수수료 예상(견적 기준): 그 달 선정, 대상 건 */
  guidance_count: number;
  guidance_fee: number | null;
  /** 성사수수료 정산(계약 기준): 그 달 계약 확인(의뢰자 확인·7일 뒤 자동·운영자 정리), signed (0025) */
  settled_count: number;
  settled_contract_amount: number;
  settled_fee: number | null;
  /** 월 구독료 + 건당 이용료 + 성사수수료 정산 + 조정 항목(0024) (미정은 0 으로 더함) */
  total_due: number;
  /** 미정 금액이 있음 */
  terms_pending: boolean;
};

/** billing_lines() 한 행: 그 달에 청구 기준 시각(billing_at, 금액이 없으면 first_submitted_at)이 있는 견적 1건 */
export type BillingLineRow = {
  quote_id: string;
  invite_id: string;
  rfq_id: string;
  rfq_no: string;
  org_id: string;
  org_name: string;
  managed: boolean;
  first_submitted_at: string;
  /** 금액이 있는 상태로 처음 제출된 시각 (청구 월). 금액 미입력이면 null. 0020 수정 전 저장본에는 없다 */
  billing_at?: string | null;
  total_amount: number | null;
  entry_source: QuoteEntrySource;
  auto: boolean;
  invite_source: string;
  billable: boolean;
  bill_excluded_reason: string | null;
  tier: "no_amount" | "subscription" | "per_quote" | "per_quote_success";
  /** 건당 이용료를 청구하는 행 */
  chargeable: boolean;
  per_request_fee: number | null;
  /** 청구할 건당 이용료. 대상 아니면 0, 단가 미정이면 null */
  fee_due: number | null;
  /** 참여 기록 (0023). joined 만 청구한다. 0023 전 저장본에는 없다 */
  join_status?: JoinStatus;
  joined_at?: string | null;
};

/** billing_awards() 한 행: 성사수수료 대상 (선정 견적 5,000만 원 이상) */
export type BillingAwardRow = {
  /** guidance 예상(견적 기준, 선정한 달) · settlement 정산(계약 기준, 계약이 확인된 달. 0025 전에는 체결 보고한 달) */
  kind: "guidance" | "settlement";
  award_id: string;
  rfq_id: string;
  rfq_no: string;
  org_id: string;
  org_name: string;
  quote_amount: number;
  contract_amount: number | null;
  contract_status: ContractStatus;
  awarded_at: string;
  contract_date: string | null;
  contract_reported_at: string | null;
  fee_rate: number | null;
  /** 요율 미정이면 null */
  fee: number | null;
  /** 그 초대가 청구 대상인지 (false 면 운영자가 견적 청구를 제외한 초대). 0020 수정 전 저장본에는 없다 */
  invite_billable?: boolean;
  /** 그 초대에 기관 본인의 참여 기록(portal·token)이 있는지. false 면 명세 합계에 넣지 않는다 (0023). 0023 전 저장본에는 없다 */
  invite_joined?: boolean;
  /** 계약이 확인된 시각과 경로 (0025). 정산 행은 이 시각의 달에 나온다. 0025 전 저장본에는 없다 */
  contract_confirmed_at?: string | null;
  contract_confirmed_via?: ContractConfirmVia | null;
};

/** billing_adjustment_lines() 한 행: 조정 항목 1건 (0024). amount 는 원, 돌려주면 음수 */
export type BillingAdjustmentRow = {
  adjustment_id: string;
  org_id: string;
  org_name: string;
  /** 적용 월 (그 달 1일) */
  month: string;
  amount: number;
  reason: string;
  /** 바로잡는 마감 월 (그 달 1일). 없으면 null */
  corrects_month: string | null;
  created_by: string | null;
  created_at: string;
};

/** 참고 단가 출처: org 기관 약정 값 · reference 참고 단가(예시, 시장 검증 전) */
export type ReferenceSource = "org" | "reference";

/** billing_reference() 한 행: 시범 기간이라 청구하지 않은 견적·체결의 "유료였다면" 수치 (0024). 합계·청구에 넣지 않는다 */
export type BillingReferenceRow = {
  org_id: string;
  org_name: string;
  /** 1,000만 원 미만 견적 수 (구독 구간, 구독료 미정이라 금액 없음) */
  subscription_count: number;
  /** 1,000만 원 이상 견적 수 */
  per_quote_count: number;
  per_quote_unit: number;
  per_quote_unit_source: ReferenceSource;
  /** 참고 건당 이용료 = 건수 × 단가 */
  per_quote_fee: number;
  /** 체결 확인된 수주 (선정 견적 5,000만 원 이상, signed) */
  success_count: number;
  success_contract_amount: number;
  success_rate: number;
  success_rate_source: ReferenceSource;
  /** 참고 성사수수료 = 계약 금액 × 요율 */
  success_fee: number;
};

/** billing_periods.snapshot: 마감 때 저장한 그 달 명세. adjustments·reference 는 0024 부터 (그 전 저장본에는 없다) */
export type BillingSnapshot = {
  taken_at: string;
  summary: BillingSummaryRow[];
  lines: BillingLineRow[];
  awards: BillingAwardRow[];
  adjustments?: BillingAdjustmentRow[];
  reference?: BillingReferenceRow[];
};
