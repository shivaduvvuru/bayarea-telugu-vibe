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
      cities: {
        Row: {
          active: boolean
          created_at: string
          name: string
          region: string | null
          slug: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          name: string
          region?: string | null
          slug: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          name?: string
          region?: string | null
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      collect_runs: {
        Row: {
          collected: number
          duplicates_hidden: number
          error: string | null
          finished_at: string
          funnel: Json
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
          funnel?: Json
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
          funnel?: Json
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
          ai_generated_at: string | null
          body: string | null
          canonical_image: string | null
          canonical_url: string | null
          category: string | null
          city: string | null
          confidence: Database["public"]["Enums"]["source_confidence"] | null
          content_label: Database["public"]["Enums"]["content_label"] | null
          corrected_at: string | null
          correction_note: string | null
          created_at: string
          dedupe_key: string | null
          duplicate_of: string | null
          event_end: string | null
          event_start: string | null
          id: string
          image_backfill_attempts: number | null
          image_url: string | null
          is_local: boolean
          kind: string
          last_shown_at: string | null
          link_url: string | null
          norm_title: string | null
          people_checked_at: string | null
          people_count: number | null
          placement: string
          priority_score: number | null
          published_at: string | null
          region: string | null
          resolved_category: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source: string
          source_id: string | null
          source_names: string[] | null
          source_ref: string | null
          status: string
          story_cluster_id: string | null
          summary: string | null
          title: string
          updated_at: string
          venue: string | null
          what_to_do: string | null
          why_it_matters: string | null
        }
        Insert: {
          ai_generated_at?: string | null
          body?: string | null
          canonical_image?: string | null
          canonical_url?: string | null
          category?: string | null
          city?: string | null
          confidence?: Database["public"]["Enums"]["source_confidence"] | null
          content_label?: Database["public"]["Enums"]["content_label"] | null
          corrected_at?: string | null
          correction_note?: string | null
          created_at?: string
          dedupe_key?: string | null
          duplicate_of?: string | null
          event_end?: string | null
          event_start?: string | null
          id?: string
          image_backfill_attempts?: number | null
          image_url?: string | null
          is_local?: boolean
          kind?: string
          last_shown_at?: string | null
          link_url?: string | null
          norm_title?: string | null
          people_checked_at?: string | null
          people_count?: number | null
          placement?: string
          priority_score?: number | null
          published_at?: string | null
          region?: string | null
          resolved_category?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          source_id?: string | null
          source_names?: string[] | null
          source_ref?: string | null
          status?: string
          story_cluster_id?: string | null
          summary?: string | null
          title: string
          updated_at?: string
          venue?: string | null
          what_to_do?: string | null
          why_it_matters?: string | null
        }
        Update: {
          ai_generated_at?: string | null
          body?: string | null
          canonical_image?: string | null
          canonical_url?: string | null
          category?: string | null
          city?: string | null
          confidence?: Database["public"]["Enums"]["source_confidence"] | null
          content_label?: Database["public"]["Enums"]["content_label"] | null
          corrected_at?: string | null
          correction_note?: string | null
          created_at?: string
          dedupe_key?: string | null
          duplicate_of?: string | null
          event_end?: string | null
          event_start?: string | null
          id?: string
          image_backfill_attempts?: number | null
          image_url?: string | null
          is_local?: boolean
          kind?: string
          last_shown_at?: string | null
          link_url?: string | null
          norm_title?: string | null
          people_checked_at?: string | null
          people_count?: number | null
          placement?: string
          priority_score?: number | null
          published_at?: string | null
          region?: string | null
          resolved_category?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          source_id?: string | null
          source_names?: string[] | null
          source_ref?: string | null
          status?: string
          story_cluster_id?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
          venue?: string | null
          what_to_do?: string | null
          why_it_matters?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_items_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "content_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_story_cluster_id_fkey"
            columns: ["story_cluster_id"]
            isOneToOne: false
            referencedRelation: "story_clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      content_sources: {
        Row: {
          active: boolean
          api_url: string | null
          cities: string[]
          confidence: Database["public"]["Enums"]["source_confidence"]
          connector_type: Database["public"]["Enums"]["connector_type"]
          created_at: string
          duplicates_removed: number
          frequency_minutes: number
          id: string
          items_discovered: number
          items_published: number
          last_checked_at: string | null
          last_error: string | null
          last_success_at: string | null
          name: string
          notes: string | null
          read_original_clicks: number
          rss_url: string | null
          source_class: Database["public"]["Enums"]["source_class"]
          source_url: string | null
          status: Database["public"]["Enums"]["source_status"]
          topics: string[]
          updated_at: string
        }
        Insert: {
          active?: boolean
          api_url?: string | null
          cities?: string[]
          confidence?: Database["public"]["Enums"]["source_confidence"]
          connector_type?: Database["public"]["Enums"]["connector_type"]
          created_at?: string
          duplicates_removed?: number
          frequency_minutes?: number
          id?: string
          items_discovered?: number
          items_published?: number
          last_checked_at?: string | null
          last_error?: string | null
          last_success_at?: string | null
          name: string
          notes?: string | null
          read_original_clicks?: number
          rss_url?: string | null
          source_class?: Database["public"]["Enums"]["source_class"]
          source_url?: string | null
          status?: Database["public"]["Enums"]["source_status"]
          topics?: string[]
          updated_at?: string
        }
        Update: {
          active?: boolean
          api_url?: string | null
          cities?: string[]
          confidence?: Database["public"]["Enums"]["source_confidence"]
          connector_type?: Database["public"]["Enums"]["connector_type"]
          created_at?: string
          duplicates_removed?: number
          frequency_minutes?: number
          id?: string
          items_discovered?: number
          items_published?: number
          last_checked_at?: string | null
          last_error?: string | null
          last_success_at?: string | null
          name?: string
          notes?: string | null
          read_original_clicks?: number
          rss_url?: string | null
          source_class?: Database["public"]["Enums"]["source_class"]
          source_url?: string | null
          status?: Database["public"]["Enums"]["source_status"]
          topics?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      digest_queue: {
        Row: {
          city_slug: string
          created_at: string
          dedupe_key: string | null
          digest_date: string
          error: string | null
          image_source: string | null
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
          image_source?: string | null
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
          image_source?: string | null
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
      digest_rejects: {
        Row: {
          created_at: string
          dedupe_key: string
          item_id: string | null
          reason: string | null
          title: string | null
        }
        Insert: {
          created_at?: string
          dedupe_key: string
          item_id?: string | null
          reason?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string
          dedupe_key?: string
          item_id?: string | null
          reason?: string | null
          title?: string | null
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
      directory_entities: {
        Row: {
          accessibility: string | null
          address: string | null
          attribution: string | null
          category: string
          city: string | null
          community_tags: string[]
          county: string | null
          created_at: string
          dedupe_key: string | null
          deity: string | null
          description: string | null
          email: string | null
          entity_type: string
          events_url: string | null
          external_url: string | null
          extra_categories: string[]
          featured_status: boolean
          foursquare_id: string | null
          google_place_id: string | null
          hours: string | null
          id: string
          image: string | null
          last_synced_at: string | null
          last_verified_at: string | null
          latitude: number | null
          longitude: number | null
          name: string
          needs_review: boolean
          osm_id: string | null
          phone: string | null
          price_level: number | null
          service_tags: string[]
          slug: string
          source: string
          source_id: string | null
          state: string
          status: string
          subcategory: string | null
          tba_rating: number | null
          tba_review_count: number
          updated_at: string
          verified_status: boolean
          website: string | null
          yelp_id: string | null
          zip: string | null
        }
        Insert: {
          accessibility?: string | null
          address?: string | null
          attribution?: string | null
          category: string
          city?: string | null
          community_tags?: string[]
          county?: string | null
          created_at?: string
          dedupe_key?: string | null
          deity?: string | null
          description?: string | null
          email?: string | null
          entity_type?: string
          events_url?: string | null
          external_url?: string | null
          extra_categories?: string[]
          featured_status?: boolean
          foursquare_id?: string | null
          google_place_id?: string | null
          hours?: string | null
          id?: string
          image?: string | null
          last_synced_at?: string | null
          last_verified_at?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          needs_review?: boolean
          osm_id?: string | null
          phone?: string | null
          price_level?: number | null
          service_tags?: string[]
          slug: string
          source?: string
          source_id?: string | null
          state?: string
          status?: string
          subcategory?: string | null
          tba_rating?: number | null
          tba_review_count?: number
          updated_at?: string
          verified_status?: boolean
          website?: string | null
          yelp_id?: string | null
          zip?: string | null
        }
        Update: {
          accessibility?: string | null
          address?: string | null
          attribution?: string | null
          category?: string
          city?: string | null
          community_tags?: string[]
          county?: string | null
          created_at?: string
          dedupe_key?: string | null
          deity?: string | null
          description?: string | null
          email?: string | null
          entity_type?: string
          events_url?: string | null
          external_url?: string | null
          extra_categories?: string[]
          featured_status?: boolean
          foursquare_id?: string | null
          google_place_id?: string | null
          hours?: string | null
          id?: string
          image?: string | null
          last_synced_at?: string | null
          last_verified_at?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          needs_review?: boolean
          osm_id?: string | null
          phone?: string | null
          price_level?: number | null
          service_tags?: string[]
          slug?: string
          source?: string
          source_id?: string | null
          state?: string
          status?: string
          subcategory?: string | null
          tba_rating?: number | null
          tba_review_count?: number
          updated_at?: string
          verified_status?: boolean
          website?: string | null
          yelp_id?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      directory_ingest_state: {
        Row: {
          cursor_index: number
          id: string
          last_slice: string | null
          total_slices: number
          updated_at: string
        }
        Insert: {
          cursor_index?: number
          id?: string
          last_slice?: string | null
          total_slices?: number
          updated_at?: string
        }
        Update: {
          cursor_index?: number
          id?: string
          last_slice?: string | null
          total_slices?: number
          updated_at?: string
        }
        Relationships: []
      }
      directory_slice_fingerprints: {
        Row: {
          checked_at: string
          element_count: number
          fingerprint: string
          slice: string
          updated_at: string
        }
        Insert: {
          checked_at?: string
          element_count?: number
          fingerprint: string
          slice: string
          updated_at?: string
        }
        Update: {
          checked_at?: string
          element_count?: number
          fingerprint?: string
          slice?: string
          updated_at?: string
        }
        Relationships: []
      }
      editorial_reviews: {
        Row: {
          action: string
          created_at: string
          editor_id: string | null
          id: string
          notes: string | null
          raw_item_id: string | null
          rejection_reason: string | null
        }
        Insert: {
          action: string
          created_at?: string
          editor_id?: string | null
          id?: string
          notes?: string | null
          raw_item_id?: string | null
          rejection_reason?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          editor_id?: string | null
          id?: string
          notes?: string | null
          raw_item_id?: string | null
          rejection_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "editorial_reviews_raw_item_id_fkey"
            columns: ["raw_item_id"]
            isOneToOne: false
            referencedRelation: "raw_ingestion_items"
            referencedColumns: ["id"]
          },
        ]
      }
      external_api_budget: {
        Row: {
          calls: number
          cost_per_1k_usd: number
          enabled: boolean
          month: string
          monthly_limit_usd: number
          provider: string
          spend_usd: number
          updated_at: string
        }
        Insert: {
          calls?: number
          cost_per_1k_usd?: number
          enabled?: boolean
          month?: string
          monthly_limit_usd?: number
          provider: string
          spend_usd?: number
          updated_at?: string
        }
        Update: {
          calls?: number
          cost_per_1k_usd?: number
          enabled?: boolean
          month?: string
          monthly_limit_usd?: number
          provider?: string
          spend_usd?: number
          updated_at?: string
        }
        Relationships: []
      }
      food_collection_items: {
        Row: {
          collection_id: string
          created_at: string
          note: string | null
          position: number
          restaurant_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          note?: string | null
          position?: number
          restaurant_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          note?: string | null
          position?: number
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "food_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_collection_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      food_collections: {
        Row: {
          city: string | null
          created_at: string
          cuisine: string | null
          description: string | null
          id: string
          slug: string
          sort_order: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          cuisine?: string | null
          description?: string | null
          id?: string
          slug: string
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          cuisine?: string | null
          description?: string | null
          id?: string
          slug?: string
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
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
      headline_picks: {
        Row: {
          content_id: string | null
          label: string | null
          slot: string
          updated_at: string
        }
        Insert: {
          content_id?: string | null
          label?: string | null
          slot: string
          updated_at?: string
        }
        Update: {
          content_id?: string | null
          label?: string | null
          slot?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "headline_picks_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
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
      image_fingerprints: {
        Row: {
          bytes: number | null
          content_type: string | null
          created_at: string
          file_hash: string | null
          id: string
          image_url: string
          perceptual_hash: string | null
          updated_at: string
        }
        Insert: {
          bytes?: number | null
          content_type?: string | null
          created_at?: string
          file_hash?: string | null
          id?: string
          image_url: string
          perceptual_hash?: string | null
          updated_at?: string
        }
        Update: {
          bytes?: number | null
          content_type?: string | null
          created_at?: string
          file_hash?: string | null
          id?: string
          image_url?: string
          perceptual_hash?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ingest_runs: {
        Row: {
          category: string | null
          error: string | null
          finished_at: string
          id: string
          items_found: number
          items_inserted: number
          mode: string
          run_id: string
          source: string
          started_at: string
          status: string
          trigger: string
        }
        Insert: {
          category?: string | null
          error?: string | null
          finished_at?: string
          id?: string
          items_found?: number
          items_inserted?: number
          mode: string
          run_id: string
          source: string
          started_at?: string
          status: string
          trigger?: string
        }
        Update: {
          category?: string | null
          error?: string | null
          finished_at?: string
          id?: string
          items_found?: number
          items_inserted?: number
          mode?: string
          run_id?: string
          source?: string
          started_at?: string
          status?: string
          trigger?: string
        }
        Relationships: []
      }
      page_views: {
        Row: {
          day: string
          updated_at: string
          views: number
        }
        Insert: {
          day: string
          updated_at?: string
          views?: number
        }
        Update: {
          day?: string
          updated_at?: string
          views?: number
        }
        Relationships: []
      }
      photo_likes: {
        Row: {
          likes: number
          slug: string
          updated_at: string
        }
        Insert: {
          likes?: number
          slug: string
          updated_at?: string
        }
        Update: {
          likes?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      picture_intake: {
        Row: {
          city_slug: string | null
          created_at: string
          dedupe_key: string | null
          discovered_at: string
          event: string | null
          image_url: string
          industry: string | null
          item_id: string
          metadata: Json
          queue_item_id: string | null
          reviewed_at: string | null
          safety_reason: string | null
          screening_state: string
          source: string | null
          source_url: string | null
          stage: string
          star: string | null
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          city_slug?: string | null
          created_at?: string
          dedupe_key?: string | null
          discovered_at?: string
          event?: string | null
          image_url: string
          industry?: string | null
          item_id: string
          metadata?: Json
          queue_item_id?: string | null
          reviewed_at?: string | null
          safety_reason?: string | null
          screening_state?: string
          source?: string | null
          source_url?: string | null
          stage?: string
          star?: string | null
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          city_slug?: string | null
          created_at?: string
          dedupe_key?: string | null
          discovered_at?: string
          event?: string | null
          image_url?: string
          industry?: string | null
          item_id?: string
          metadata?: Json
          queue_item_id?: string | null
          reviewed_at?: string | null
          safety_reason?: string | null
          screening_state?: string
          source?: string | null
          source_url?: string | null
          stage?: string
          star?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          amenities: string[]
          campaign_slug: string
          configuration: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          developer: string
          developer_logo_url: string | null
          enquiry_url: string | null
          gallery_urls: string[]
          id: string
          image_url: string | null
          is_credai_participant: boolean
          is_tt_advertiser: boolean
          locality: string | null
          price_from_lakh: number | null
          price_note: string | null
          priority: number
          project_name: string
          project_status: string | null
          property_type: string | null
          rera_number: string | null
          slug: string
          source_name: string | null
          source_url: string | null
          status: string
          updated_at: string
          website_url: string | null
          zone: string | null
        }
        Insert: {
          amenities?: string[]
          campaign_slug: string
          configuration?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          developer: string
          developer_logo_url?: string | null
          enquiry_url?: string | null
          gallery_urls?: string[]
          id?: string
          image_url?: string | null
          is_credai_participant?: boolean
          is_tt_advertiser?: boolean
          locality?: string | null
          price_from_lakh?: number | null
          price_note?: string | null
          priority?: number
          project_name: string
          project_status?: string | null
          property_type?: string | null
          rera_number?: string | null
          slug: string
          source_name?: string | null
          source_url?: string | null
          status?: string
          updated_at?: string
          website_url?: string | null
          zone?: string | null
        }
        Update: {
          amenities?: string[]
          campaign_slug?: string
          configuration?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          developer?: string
          developer_logo_url?: string | null
          enquiry_url?: string | null
          gallery_urls?: string[]
          id?: string
          image_url?: string | null
          is_credai_participant?: boolean
          is_tt_advertiser?: boolean
          locality?: string | null
          price_from_lakh?: number | null
          price_note?: string | null
          priority?: number
          project_name?: string
          project_status?: string | null
          property_type?: string | null
          rera_number?: string | null
          slug?: string
          source_name?: string | null
          source_url?: string | null
          status?: string
          updated_at?: string
          website_url?: string | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_campaign_slug_fkey"
            columns: ["campaign_slug"]
            isOneToOne: false
            referencedRelation: "property_campaigns"
            referencedColumns: ["slug"]
          },
        ]
      }
      property_campaigns: {
        Row: {
          active: boolean
          campaign_end: string | null
          campaign_start: string | null
          city: string | null
          created_at: string
          event_end: string | null
          event_month_label: string | null
          event_start: string | null
          headline: string
          hero_image_url: string | null
          homepage_visible: boolean
          id: string
          live_mode: boolean
          live_note: string | null
          map_url: string | null
          name: string
          official_url: string | null
          opening_hours: string | null
          organizer: string | null
          participation_note: string | null
          post_event: boolean
          promo_line: string | null
          promo_title: string | null
          slug: string
          subheading: string | null
          updated_at: string
          venue: string | null
        }
        Insert: {
          active?: boolean
          campaign_end?: string | null
          campaign_start?: string | null
          city?: string | null
          created_at?: string
          event_end?: string | null
          event_month_label?: string | null
          event_start?: string | null
          headline: string
          hero_image_url?: string | null
          homepage_visible?: boolean
          id?: string
          live_mode?: boolean
          live_note?: string | null
          map_url?: string | null
          name: string
          official_url?: string | null
          opening_hours?: string | null
          organizer?: string | null
          participation_note?: string | null
          post_event?: boolean
          promo_line?: string | null
          promo_title?: string | null
          slug: string
          subheading?: string | null
          updated_at?: string
          venue?: string | null
        }
        Update: {
          active?: boolean
          campaign_end?: string | null
          campaign_start?: string | null
          city?: string | null
          created_at?: string
          event_end?: string | null
          event_month_label?: string | null
          event_start?: string | null
          headline?: string
          hero_image_url?: string | null
          homepage_visible?: boolean
          id?: string
          live_mode?: boolean
          live_note?: string | null
          map_url?: string | null
          name?: string
          official_url?: string | null
          opening_hours?: string | null
          organizer?: string | null
          participation_note?: string | null
          post_event?: boolean
          promo_line?: string | null
          promo_title?: string | null
          slug?: string
          subheading?: string | null
          updated_at?: string
          venue?: string | null
        }
        Relationships: []
      }
      property_leads: {
        Row: {
          budget: string | null
          campaign_code: string
          campaign_slug: string
          city: string | null
          contact_status: string
          country: string | null
          created_at: string
          developers: string[]
          email: string
          follow_up_note: string | null
          id: string
          message: string | null
          name: string
          phone: string | null
          preferred_contact: string | null
          project_names: string[]
          property_ids: string[]
          referrer: string | null
          source_page: string | null
          updated_at: string
          utm: Json
        }
        Insert: {
          budget?: string | null
          campaign_code?: string
          campaign_slug: string
          city?: string | null
          contact_status?: string
          country?: string | null
          created_at?: string
          developers?: string[]
          email: string
          follow_up_note?: string | null
          id?: string
          message?: string | null
          name: string
          phone?: string | null
          preferred_contact?: string | null
          project_names?: string[]
          property_ids?: string[]
          referrer?: string | null
          source_page?: string | null
          updated_at?: string
          utm?: Json
        }
        Update: {
          budget?: string | null
          campaign_code?: string
          campaign_slug?: string
          city?: string | null
          contact_status?: string
          country?: string | null
          created_at?: string
          developers?: string[]
          email?: string
          follow_up_note?: string | null
          id?: string
          message?: string | null
          name?: string
          phone?: string | null
          preferred_contact?: string | null
          project_names?: string[]
          property_ids?: string[]
          referrer?: string | null
          source_page?: string | null
          updated_at?: string
          utm?: Json
        }
        Relationships: []
      }
      property_live_posts: {
        Row: {
          body: string | null
          booth: string | null
          campaign_slug: string
          created_at: string
          developer: string | null
          id: string
          kind: string
          media_url: string | null
          pinned: boolean
          poster_url: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          booth?: string | null
          campaign_slug: string
          created_at?: string
          developer?: string | null
          id?: string
          kind?: string
          media_url?: string | null
          pinned?: boolean
          poster_url?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          booth?: string | null
          campaign_slug?: string
          created_at?: string
          developer?: string | null
          id?: string
          kind?: string
          media_url?: string | null
          pinned?: boolean
          poster_url?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_live_posts_campaign_slug_fkey"
            columns: ["campaign_slug"]
            isOneToOne: false
            referencedRelation: "property_campaigns"
            referencedColumns: ["slug"]
          },
        ]
      }
      property_metrics: {
        Row: {
          campaign_slug: string
          country: string | null
          created_at: string
          developer: string | null
          id: number
          kind: string
          path: string | null
          project_name: string | null
          property_id: string | null
          referrer: string | null
          utm_source: string | null
        }
        Insert: {
          campaign_slug: string
          country?: string | null
          created_at?: string
          developer?: string | null
          id?: number
          kind: string
          path?: string | null
          project_name?: string | null
          property_id?: string | null
          referrer?: string | null
          utm_source?: string | null
        }
        Update: {
          campaign_slug?: string
          country?: string | null
          created_at?: string
          developer?: string | null
          id?: number
          kind?: string
          path?: string | null
          project_name?: string | null
          property_id?: string | null
          referrer?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
      property_video_clicks: {
        Row: {
          created_at: string
          feature_id: string
          id: number
          kind: string
          path: string | null
          project: string | null
          video_id: string | null
        }
        Insert: {
          created_at?: string
          feature_id: string
          id?: number
          kind?: string
          path?: string | null
          project?: string | null
          video_id?: string | null
        }
        Update: {
          created_at?: string
          feature_id?: string
          id?: number
          kind?: string
          path?: string | null
          project?: string | null
          video_id?: string | null
        }
        Relationships: []
      }
      property_videos: {
        Row: {
          created_at: string
          developer: string | null
          feature_id: string
          note: string | null
          project: string
          status: string
          title: string | null
          updated_at: string
          verified_at: string | null
          video_id: string
        }
        Insert: {
          created_at?: string
          developer?: string | null
          feature_id: string
          note?: string | null
          project: string
          status?: string
          title?: string | null
          updated_at?: string
          verified_at?: string | null
          video_id: string
        }
        Update: {
          created_at?: string
          developer?: string | null
          feature_id?: string
          note?: string | null
          project?: string
          status?: string
          title?: string | null
          updated_at?: string
          verified_at?: string | null
          video_id?: string
        }
        Relationships: []
      }
      raw_ingestion_items: {
        Row: {
          ai_generated_at: string | null
          author: string | null
          canonical_url: string
          city: string | null
          community_relevance: number
          connector_type: Database["public"]["Enums"]["connector_type"]
          created_at: string
          deadline_at: string | null
          dedupe_key: string | null
          dedupe_status: Database["public"]["Enums"]["dedupe_status"]
          digest_headline: string | null
          discovered_datetime: string
          duplicate_of: string | null
          event_start: string | null
          excerpt: string | null
          external_item_id: string | null
          id: string
          image_url: string | null
          original_title: string
          priority_score: number
          processing_status: Database["public"]["Enums"]["ingest_status"]
          publication_datetime: string | null
          published_content_item_id: string | null
          raw_metadata: Json
          requires_human_review: boolean
          source_id: string | null
          source_name: string
          story_cluster_id: string | null
          tags: string[]
          topic: string | null
          updated_at: string
          urgency: string | null
          what_happened: string | null
          what_to_do: string | null
          why_it_matters: string | null
        }
        Insert: {
          ai_generated_at?: string | null
          author?: string | null
          canonical_url: string
          city?: string | null
          community_relevance?: number
          connector_type?: Database["public"]["Enums"]["connector_type"]
          created_at?: string
          deadline_at?: string | null
          dedupe_key?: string | null
          dedupe_status?: Database["public"]["Enums"]["dedupe_status"]
          digest_headline?: string | null
          discovered_datetime?: string
          duplicate_of?: string | null
          event_start?: string | null
          excerpt?: string | null
          external_item_id?: string | null
          id?: string
          image_url?: string | null
          original_title: string
          priority_score?: number
          processing_status?: Database["public"]["Enums"]["ingest_status"]
          publication_datetime?: string | null
          published_content_item_id?: string | null
          raw_metadata?: Json
          requires_human_review?: boolean
          source_id?: string | null
          source_name: string
          story_cluster_id?: string | null
          tags?: string[]
          topic?: string | null
          updated_at?: string
          urgency?: string | null
          what_happened?: string | null
          what_to_do?: string | null
          why_it_matters?: string | null
        }
        Update: {
          ai_generated_at?: string | null
          author?: string | null
          canonical_url?: string
          city?: string | null
          community_relevance?: number
          connector_type?: Database["public"]["Enums"]["connector_type"]
          created_at?: string
          deadline_at?: string | null
          dedupe_key?: string | null
          dedupe_status?: Database["public"]["Enums"]["dedupe_status"]
          digest_headline?: string | null
          discovered_datetime?: string
          duplicate_of?: string | null
          event_start?: string | null
          excerpt?: string | null
          external_item_id?: string | null
          id?: string
          image_url?: string | null
          original_title?: string
          priority_score?: number
          processing_status?: Database["public"]["Enums"]["ingest_status"]
          publication_datetime?: string | null
          published_content_item_id?: string | null
          raw_metadata?: Json
          requires_human_review?: boolean
          source_id?: string | null
          source_name?: string
          story_cluster_id?: string | null
          tags?: string[]
          topic?: string | null
          updated_at?: string
          urgency?: string | null
          what_happened?: string | null
          what_to_do?: string | null
          why_it_matters?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "raw_ingestion_items_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "raw_ingestion_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_ingestion_items_published_content_item_id_fkey"
            columns: ["published_content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_ingestion_items_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "content_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_ingestion_items_story_cluster_id_fkey"
            columns: ["story_cluster_id"]
            isOneToOne: false
            referencedRelation: "story_clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      rejected_duplicates: {
        Row: {
          created_at: string
          dedupe_key: string | null
          entry_point: string | null
          id: string
          kind: string
          link_url: string | null
          original_id: string | null
          original_url: string | null
          payload: Json
          reason: string
          score: number | null
          source: string | null
          title: string | null
        }
        Insert: {
          created_at?: string
          dedupe_key?: string | null
          entry_point?: string | null
          id?: string
          kind?: string
          link_url?: string | null
          original_id?: string | null
          original_url?: string | null
          payload?: Json
          reason: string
          score?: number | null
          source?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string
          dedupe_key?: string | null
          entry_point?: string | null
          id?: string
          kind?: string
          link_url?: string | null
          original_id?: string | null
          original_url?: string | null
          payload?: Json
          reason?: string
          score?: number | null
          source?: string | null
          title?: string | null
        }
        Relationships: []
      }
      restaurant_claim_contacts: {
        Row: {
          claim_id: string
          contact_email: string
          contact_name: string
          contact_phone: string | null
          contact_role: string | null
          created_at: string
        }
        Insert: {
          claim_id: string
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          contact_role?: string | null
          created_at?: string
        }
        Update: {
          claim_id?: string
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          contact_role?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_claim_contacts_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: true
            referencedRelation: "restaurant_claims"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_claims: {
        Row: {
          city: string | null
          created_at: string
          id: string
          kind: string
          payload: Json
          restaurant_id: string | null
          restaurant_name: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          restaurant_id?: string | null
          restaurant_name: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          restaurant_id?: string | null
          restaurant_name?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_claims_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_deals: {
        Row: {
          city: string | null
          code: string | null
          created_at: string
          cuisine: string | null
          deal_type: string
          description: string | null
          ends_at: string | null
          id: string
          restaurant_id: string | null
          sponsored: boolean
          starts_at: string | null
          status: string
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          city?: string | null
          code?: string | null
          created_at?: string
          cuisine?: string | null
          deal_type?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          restaurant_id?: string | null
          sponsored?: boolean
          starts_at?: string | null
          status?: string
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          city?: string | null
          code?: string | null
          created_at?: string
          cuisine?: string | null
          deal_type?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          restaurant_id?: string | null
          sponsored?: boolean
          starts_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_deals_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_ratings: {
        Row: {
          created_at: string
          external_url: string | null
          fetched_at: string | null
          rating: number | null
          restaurant_id: string
          review_count: number | null
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_url?: string | null
          fetched_at?: string | null
          rating?: number | null
          restaurant_id: string
          review_count?: number | null
          source: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_url?: string | null
          fetched_at?: string | null
          rating?: number | null
          restaurant_id?: string
          review_count?: number | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_ratings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_reviews: {
        Row: {
          author_name: string
          body: string | null
          created_at: string
          dishes: string[]
          family_friendly: boolean
          id: string
          photos: string[]
          rating: number
          recommends: boolean
          restaurant_id: string
          status: string
          updated_at: string
          user_id: string
          veg_favorite: boolean
        }
        Insert: {
          author_name?: string
          body?: string | null
          created_at?: string
          dishes?: string[]
          family_friendly?: boolean
          id?: string
          photos?: string[]
          rating: number
          recommends?: boolean
          restaurant_id: string
          status?: string
          updated_at?: string
          user_id: string
          veg_favorite?: boolean
        }
        Update: {
          author_name?: string
          body?: string | null
          created_at?: string
          dishes?: string[]
          family_friendly?: boolean
          id?: string
          photos?: string[]
          rating?: number
          recommends?: boolean
          restaurant_id?: string
          status?: string
          updated_at?: string
          user_id?: string
          veg_favorite?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          attribution: string | null
          branch_label: string | null
          city: string | null
          created_at: string
          cuisines: string[]
          dedupe_key: string | null
          description: string | null
          dietary: string[]
          dish_tags: string[]
          features: string[]
          foursquare_id: string | null
          google_place_id: string | null
          has_catering: boolean
          has_delivery: boolean
          has_dine_in: boolean
          has_pickup: boolean
          has_reservations: boolean
          hours: Json
          hours_text: string | null
          id: string
          last_refreshed_at: string | null
          latitude: number | null
          longitude: number | null
          menu_url: string | null
          name: string
          opened_at: string | null
          order_links: Json
          osm_id: string | null
          phone: string | null
          photos: string[]
          price_level: number | null
          refresh_failures: number
          region: string | null
          reservation_url: string | null
          restaurant_types: string[]
          slug: string
          source: string
          sponsored: boolean
          status: string
          updated_at: string
          verified: boolean
          website_url: string | null
          yelp_id: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          attribution?: string | null
          branch_label?: string | null
          city?: string | null
          created_at?: string
          cuisines?: string[]
          dedupe_key?: string | null
          description?: string | null
          dietary?: string[]
          dish_tags?: string[]
          features?: string[]
          foursquare_id?: string | null
          google_place_id?: string | null
          has_catering?: boolean
          has_delivery?: boolean
          has_dine_in?: boolean
          has_pickup?: boolean
          has_reservations?: boolean
          hours?: Json
          hours_text?: string | null
          id?: string
          last_refreshed_at?: string | null
          latitude?: number | null
          longitude?: number | null
          menu_url?: string | null
          name: string
          opened_at?: string | null
          order_links?: Json
          osm_id?: string | null
          phone?: string | null
          photos?: string[]
          price_level?: number | null
          refresh_failures?: number
          region?: string | null
          reservation_url?: string | null
          restaurant_types?: string[]
          slug: string
          source?: string
          sponsored?: boolean
          status?: string
          updated_at?: string
          verified?: boolean
          website_url?: string | null
          yelp_id?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          attribution?: string | null
          branch_label?: string | null
          city?: string | null
          created_at?: string
          cuisines?: string[]
          dedupe_key?: string | null
          description?: string | null
          dietary?: string[]
          dish_tags?: string[]
          features?: string[]
          foursquare_id?: string | null
          google_place_id?: string | null
          has_catering?: boolean
          has_delivery?: boolean
          has_dine_in?: boolean
          has_pickup?: boolean
          has_reservations?: boolean
          hours?: Json
          hours_text?: string | null
          id?: string
          last_refreshed_at?: string | null
          latitude?: number | null
          longitude?: number | null
          menu_url?: string | null
          name?: string
          opened_at?: string | null
          order_links?: Json
          osm_id?: string | null
          phone?: string | null
          photos?: string[]
          price_level?: number | null
          refresh_failures?: number
          region?: string | null
          reservation_url?: string | null
          restaurant_types?: string[]
          slug?: string
          source?: string
          sponsored?: boolean
          status?: string
          updated_at?: string
          verified?: boolean
          website_url?: string | null
          yelp_id?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      saved_items: {
        Row: {
          content_item_id: string | null
          created_at: string
          external_ref: string | null
          id: string
          user_id: string
        }
        Insert: {
          content_item_id?: string | null
          created_at?: string
          external_ref?: string | null
          id?: string
          user_id: string
        }
        Update: {
          content_item_id?: string | null
          created_at?: string
          external_ref?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_items_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      story_clusters: {
        Row: {
          city: string | null
          created_at: string
          dedupe_key: string
          headline: string
          id: string
          item_count: number
          source_names: string[]
          story_topic_id: string | null
          topic: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          dedupe_key: string
          headline: string
          id?: string
          item_count?: number
          source_names?: string[]
          story_topic_id?: string | null
          topic?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          dedupe_key?: string
          headline?: string
          id?: string
          item_count?: number
          source_names?: string[]
          story_topic_id?: string | null
          topic?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      summary_runs: {
        Row: {
          avg_batch_size: number
          batches: number
          calls: number
          created_at: string
          fallback_calls: number
          id: string
          items_skipped: number
          items_summarized: number
          malformed_batches: number
          missing_entries: number
          retries: number
          throttled: number
          trigger: string
          truncation_rate: number
          unknown_entries: number
          unresolved: number
          warnings: string[]
        }
        Insert: {
          avg_batch_size?: number
          batches?: number
          calls?: number
          created_at?: string
          fallback_calls?: number
          id?: string
          items_skipped?: number
          items_summarized?: number
          malformed_batches?: number
          missing_entries?: number
          retries?: number
          throttled?: number
          trigger?: string
          truncation_rate?: number
          unknown_entries?: number
          unresolved?: number
          warnings?: string[]
        }
        Update: {
          avg_batch_size?: number
          batches?: number
          calls?: number
          created_at?: string
          fallback_calls?: number
          id?: string
          items_skipped?: number
          items_summarized?: number
          malformed_batches?: number
          missing_entries?: number
          retries?: number
          throttled?: number
          trigger?: string
          truncation_rate?: number
          unknown_entries?: number
          unresolved?: number
          warnings?: string[]
        }
        Relationships: []
      }
      temple_events: {
        Row: {
          all_day: boolean
          city: string | null
          cost_type: string | null
          created_at: string
          dedupe_key: string
          deities: string[]
          description: string | null
          ends_at: string | null
          event_group: string
          event_type: string
          external_uid: string | null
          featured: boolean
          id: string
          image_url: string | null
          imported: boolean
          language: string | null
          last_seen_at: string
          last_verified_at: string
          level: string
          organizer: string | null
          recurrence: string | null
          region: string | null
          register_url: string | null
          source_id: string | null
          source_kind: string
          source_url: string | null
          starts_at: string
          status: string
          temple_name: string
          temple_slug: string | null
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          city?: string | null
          cost_type?: string | null
          created_at?: string
          dedupe_key: string
          deities?: string[]
          description?: string | null
          ends_at?: string | null
          event_group?: string
          event_type?: string
          external_uid?: string | null
          featured?: boolean
          id?: string
          image_url?: string | null
          imported?: boolean
          language?: string | null
          last_seen_at?: string
          last_verified_at?: string
          level?: string
          organizer?: string | null
          recurrence?: string | null
          region?: string | null
          register_url?: string | null
          source_id?: string | null
          source_kind?: string
          source_url?: string | null
          starts_at: string
          status?: string
          temple_name: string
          temple_slug?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          city?: string | null
          cost_type?: string | null
          created_at?: string
          dedupe_key?: string
          deities?: string[]
          description?: string | null
          ends_at?: string | null
          event_group?: string
          event_type?: string
          external_uid?: string | null
          featured?: boolean
          id?: string
          image_url?: string | null
          imported?: boolean
          language?: string | null
          last_seen_at?: string
          last_verified_at?: string
          level?: string
          organizer?: string | null
          recurrence?: string | null
          region?: string | null
          register_url?: string | null
          source_id?: string | null
          source_kind?: string
          source_url?: string | null
          starts_at?: string
          status?: string
          temple_name?: string
          temple_slug?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "temple_events_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "temple_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      temple_sources: {
        Row: {
          active: boolean
          address: string | null
          auto_import: boolean
          city: string | null
          created_at: string
          deities: string[]
          events_url: string | null
          facebook_url: string | null
          fail_count: number
          gcal_url: string | null
          ics_url: string | null
          id: string
          instagram_url: string | null
          last_checked_at: string | null
          last_error: string | null
          last_success_at: string | null
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          region: string | null
          rss_url: string | null
          slug: string
          status: string
          temple_type: string | null
          traditions: string[]
          updated_at: string
          website: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          auto_import?: boolean
          city?: string | null
          created_at?: string
          deities?: string[]
          events_url?: string | null
          facebook_url?: string | null
          fail_count?: number
          gcal_url?: string | null
          ics_url?: string | null
          id?: string
          instagram_url?: string | null
          last_checked_at?: string | null
          last_error?: string | null
          last_success_at?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          region?: string | null
          rss_url?: string | null
          slug: string
          status?: string
          temple_type?: string | null
          traditions?: string[]
          updated_at?: string
          website?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          auto_import?: boolean
          city?: string | null
          created_at?: string
          deities?: string[]
          events_url?: string | null
          facebook_url?: string | null
          fail_count?: number
          gcal_url?: string | null
          ics_url?: string | null
          id?: string
          instagram_url?: string | null
          last_checked_at?: string | null
          last_error?: string | null
          last_success_at?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          region?: string | null
          rss_url?: string | null
          slug?: string
          status?: string
          temple_type?: string | null
          traditions?: string[]
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      topics: {
        Row: {
          active: boolean
          created_at: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      url_resolutions: {
        Row: {
          google_url: string
          image_url: string | null
          resolved_at: string
          resolved_url: string | null
        }
        Insert: {
          google_url: string
          image_url?: string | null
          resolved_at?: string
          resolved_url?: string | null
        }
        Update: {
          google_url?: string
          image_url?: string | null
          resolved_at?: string
          resolved_url?: string | null
        }
        Relationships: []
      }
      user_actions: {
        Row: {
          action: string
          content_item_id: string | null
          created_at: string
          id: string
          metadata: Json
          source_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          content_item_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          source_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          content_item_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          source_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_actions_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_actions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "content_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          home_city: string | null
          interests: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          home_city?: string | null
          interests?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          home_city?: string | null
          interests?: string[]
          updated_at?: string
          user_id?: string
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
      article_key_tokens: { Args: { _title: string }; Returns: string[] }
      bump_page_view: {
        Args: { _day?: string; _delta?: number }
        Returns: undefined
      }
      bump_photo_like: {
        Args: { _delta: number; _slug: string }
        Returns: number
      }
      canonical_image: { Args: { _url: string }; Returns: string }
      canonical_link: { Args: { _url: string }; Returns: string }
      find_article_duplicate: {
        Args: {
          _body?: string
          _link?: string
          _loose?: number
          _threshold?: number
          _title: string
        }
        Returns: {
          id: string
          reason: string
          score: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hook_token: { Args: { _name: string }; Returns: string }
      increment_items_published: {
        Args: { source_ids: string[] }
        Returns: undefined
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      norm_title_strict: { Args: { _title: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "editor"
      connector_type:
        | "direct_rss"
        | "direct_api"
        | "goodbarber"
        | "manual"
        | "webhook"
        | "future_connector"
      content_label:
        | "official_source"
        | "aggregated"
        | "original"
        | "community_submission"
        | "sponsored"
      dedupe_status: "unique" | "possible_duplicate" | "duplicate" | "merged"
      ingest_status:
        | "new"
        | "enriched"
        | "recommended"
        | "needs_review"
        | "approved"
        | "published"
        | "rejected"
        | "duplicate"
      review_status: "pending" | "approved" | "rejected"
      source_class:
        | "authority"
        | "reporter"
        | "community"
        | "organizer"
        | "internal"
        | "submission"
      source_confidence: "high" | "medium" | "low"
      source_status: "healthy" | "error" | "inactive"
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
      connector_type: [
        "direct_rss",
        "direct_api",
        "goodbarber",
        "manual",
        "webhook",
        "future_connector",
      ],
      content_label: [
        "official_source",
        "aggregated",
        "original",
        "community_submission",
        "sponsored",
      ],
      dedupe_status: ["unique", "possible_duplicate", "duplicate", "merged"],
      ingest_status: [
        "new",
        "enriched",
        "recommended",
        "needs_review",
        "approved",
        "published",
        "rejected",
        "duplicate",
      ],
      review_status: ["pending", "approved", "rejected"],
      source_class: [
        "authority",
        "reporter",
        "community",
        "organizer",
        "internal",
        "submission",
      ],
      source_confidence: ["high", "medium", "low"],
      source_status: ["healthy", "error", "inactive"],
      upload_state: ["none", "queued", "sent", "failed"],
    },
  },
} as const
