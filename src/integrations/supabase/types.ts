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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      collect_runs: {
        Row: {
          collected: number
          duplicates_hidden: number
          error: string | null
          finished_at: string
          held: number
          id: string
          mode: string
          ok: boolean
          published: number
          trigger: string
        }
        Insert: {
          collected?: number
          duplicates_hidden?: number
          error?: string | null
          finished_at?: string
          held?: number
          id?: string
          mode: string
          ok?: boolean
          published?: number
          trigger?: string
        }
        Update: {
          collected?: number
          duplicates_hidden?: number
          error?: string | null
          finished_at?: string
          held?: number
          id?: string
          mode?: string
          ok?: boolean
          published?: number
          trigger?: string
        }
        Relationships: []
      }
      content_item_contacts: {
        Row: {
          content_item_id: string
          created_at: string
          submitter_email: string | null
          submitter_name: string | null
        }
        Insert: {
          content_item_id: string
          created_at?: string
          submitter_email?: string | null
          submitter_name?: string | null
        }
        Update: {
          content_item_id?: string
          created_at?: string
          submitter_email?: string | null
          submitter_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_item_contacts_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: true
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          body: string | null
          category: string | null
          city: string | null
          created_at: string
          dedupe_key: string | null
          duplicate_of: string | null
          event_end: string | null
          event_start: string | null
          id: string
          image_url: string | null
          kind: string
          link_url: string | null
          placement: string
          published_at: string | null
          region: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source: string
          source_ref: string | null
          status: string
          summary: string | null
          title: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          body?: string | null
          category?: string | null
          city?: string | null
          created_at?: string
          dedupe_key?: string | null
          duplicate_of?: string | null
          event_end?: string | null
          event_start?: string | null
          id?: string
          image_url?: string | null
          kind?: string
          link_url?: string | null
          placement?: string
          published_at?: string | null
          region?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          source_ref?: string | null
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          body?: string | null
          category?: string | null
          city?: string | null
          created_at?: string
          dedupe_key?: string | null
          duplicate_of?: string | null
          event_end?: string | null
          event_start?: string | null
          id?: string
          image_url?: string | null
          kind?: string
          link_url?: string | null
          placement?: string
          published_at?: string | null
          region?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          source_ref?: string | null
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_items_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      digest_queue: {
        Row: {
          city_slug: string
          created_at: string
          dedupe_key: string | null
          digest_date: string
          error: string | null
          item_id: string
          kind: string
          origin: string
          payload: Json
          published_at: string | null
          source: string | null
          source_url: string | null
          status: Database["public"]["Enums"]["review_status"]
          summary: string | null
          title: string
          updated_at: string
          upload_status: Database["public"]["Enums"]["upload_state"]
          uploaded_at: string | null
        }
        Insert: {
          city_slug: string
          created_at?: string
          dedupe_key?: string | null
          digest_date: string
          error?: string | null
          item_id: string
          kind?: string
          origin?: string
          payload?: Json
          published_at?: string | null
          source?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          summary?: string | null
          title: string
          updated_at?: string
          upload_status?: Database["public"]["Enums"]["upload_state"]
          uploaded_at?: string | null
        }
        Update: {
          city_slug?: string
          created_at?: string
          dedupe_key?: string | null
          digest_date?: string
          error?: string | null
          item_id?: string
          kind?: string
          origin?: string
          payload?: Json
          published_at?: string | null
          source?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          summary?: string | null
          title?: string
          updated_at?: string
          upload_status?: Database["public"]["Enums"]["upload_state"]
          uploaded_at?: string | null
        }
        Relationships: []
      }
      digest_subscribers: {
        Row: {
          city: string
          confirmed_at: string | null
          created_at: string
          email: string
          id: string
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          city: string
          confirmed_at?: string | null
          created_at?: string
          email: string
          id?: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          city?: string
          confirmed_at?: string | null
          created_at?: string
          email?: string
          id?: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      directory_claim_contacts: {
        Row: {
          claim_id: string
          claimant_email: string
          claimant_name: string
          claimant_phone: string | null
          claimant_role: string | null
          created_at: string
          notes: string | null
        }
        Insert: {
          claim_id: string
          claimant_email: string
          claimant_name: string
          claimant_phone?: string | null
          claimant_role?: string | null
          created_at?: string
          notes?: string | null
        }
        Update: {
          claim_id?: string
          claimant_email?: string
          claimant_name?: string
          claimant_phone?: string | null
          claimant_role?: string | null
          created_at?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "directory_claim_contacts_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: true
            referencedRelation: "directory_claims"
            referencedColumns: ["id"]
          },
        ]
      }
      directory_claims: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          hours: string | null
          id: string
          listing_id: number
          listing_title: string
          phone: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          hours?: string | null
          id?: string
          listing_id: number
          listing_title: string
          phone?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          hours?: string | null
          id?: string
          listing_id?: number
          listing_title?: string
          phone?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      forum_replies: {
        Row: {
          ai_action: string | null
          ai_labels: Json
          ai_reason: string | null
          ai_score: number | null
          author_id: string
          author_name: string
          body: string
          created_at: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          thread_id: string
          updated_at: string
        }
        Insert: {
          ai_action?: string | null
          ai_labels?: Json
          ai_reason?: string | null
          ai_score?: number | null
          author_id: string
          author_name?: string
          body: string
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          thread_id: string
          updated_at?: string
        }
        Update: {
          ai_action?: string | null
          ai_labels?: Json
          ai_reason?: string | null
          ai_score?: number | null
          author_id?: string
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          thread_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_replies_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "forum_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_threads: {
        Row: {
          ai_action: string | null
          ai_labels: Json
          ai_reason: string | null
          ai_score: number | null
          author_id: string
          author_name: string
          body: string
          category: string
          city: string | null
          created_at: string
          id: string
          last_activity_at: string
          pinned: boolean
          reply_count: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          ai_action?: string | null
          ai_labels?: Json
          ai_reason?: string | null
          ai_score?: number | null
          author_id: string
          author_name?: string
          body: string
          category?: string
          city?: string | null
          created_at?: string
          id?: string
          last_activity_at?: string
          pinned?: boolean
          reply_count?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          ai_action?: string | null
          ai_labels?: Json
          ai_reason?: string | null
          ai_score?: number | null
          author_id?: string
          author_name?: string
          body?: string
          category?: string
          city?: string | null
          created_at?: string
          id?: string
          last_activity_at?: string
          pinned?: boolean
          reply_count?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      hook_tokens: {
        Row: {
          created_at: string
          name: string
          token: string
        }
        Insert: {
          created_at?: string
          name: string
          token?: string
        }
        Update: {
          created_at?: string
          name?: string
          token?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hook_token: { Args: { _name: string }; Returns: string }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "editor"
      review_status: "pending" | "approved" | "rejected"
      upload_state: "none" | "queued" | "sent" | "failed"
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
      app_role: ["admin", "editor"],
      review_status: ["pending", "approved", "rejected"],
      upload_state: ["none", "queued", "sent", "failed"],
    },
  },
} as const
