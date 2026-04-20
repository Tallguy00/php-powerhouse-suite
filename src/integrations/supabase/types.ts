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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bills: {
        Row: {
          amount_etb: number
          created_at: string
          customer_id: string
          due_date: string
          id: string
          kwh_consumed: number
          meter_id: string
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["bill_status"]
        }
        Insert: {
          amount_etb: number
          created_at?: string
          customer_id: string
          due_date: string
          id?: string
          kwh_consumed: number
          meter_id: string
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["bill_status"]
        }
        Update: {
          amount_etb?: number
          created_at?: string
          customer_id?: string
          due_date?: string
          id?: string
          kwh_consumed?: number
          meter_id?: string
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["bill_status"]
        }
        Relationships: [
          {
            foreignKeyName: "bills_meter_id_fkey"
            columns: ["meter_id"]
            isOneToOne: false
            referencedRelation: "meters"
            referencedColumns: ["id"]
          },
        ]
      }
      meters: {
        Row: {
          created_at: string
          customer_id: string
          customer_type: Database["public"]["Enums"]["customer_type"]
          id: string
          installed_at: string
          meter_number: string
          region_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          customer_type?: Database["public"]["Enums"]["customer_type"]
          id?: string
          installed_at?: string
          meter_number: string
          region_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          customer_type?: Database["public"]["Enums"]["customer_type"]
          id?: string
          installed_at?: string
          meter_number?: string
          region_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "meters_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      outages: {
        Row: {
          created_at: string
          description: string | null
          id: string
          location: string | null
          region_id: string | null
          reported_by: string | null
          resolved_at: string | null
          severity: Database["public"]["Enums"]["outage_severity"]
          status: Database["public"]["Enums"]["outage_status"]
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          region_id?: string | null
          reported_by?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["outage_severity"]
          status?: Database["public"]["Enums"]["outage_status"]
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          region_id?: string | null
          reported_by?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["outage_severity"]
          status?: Database["public"]["Enums"]["outage_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "outages_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_etb: number
          bill_id: string
          customer_id: string
          id: string
          method: string
          paid_at: string
          reference: string | null
        }
        Insert: {
          amount_etb: number
          bill_id: string
          customer_id: string
          id?: string
          method?: string
          paid_at?: string
          reference?: string | null
        }
        Update: {
          amount_etb?: number
          bill_id?: string
          customer_id?: string
          id?: string
          method?: string
          paid_at?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          created_at: string
          customer_number: string | null
          full_name: string | null
          id: string
          phone: string | null
          region: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          customer_number?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          region?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          customer_number?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          region?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      regions: {
        Row: {
          code: string
          created_at: string
          id: string
          name_am: string
          name_en: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name_am: string
          name_en: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name_am?: string
          name_en?: string
        }
        Relationships: []
      }
      tariffs: {
        Row: {
          active: boolean
          created_at: string
          customer_type: Database["public"]["Enums"]["customer_type"]
          id: string
          name: string
          price_per_kwh: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          customer_type: Database["public"]["Enums"]["customer_type"]
          id?: string
          name: string
          price_per_kwh: number
        }
        Update: {
          active?: boolean
          created_at?: string
          customer_type?: Database["public"]["Enums"]["customer_type"]
          id?: string
          name?: string
          price_per_kwh?: number
        }
        Relationships: []
      }
      technician_tasks: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          outage_id: string
          status: Database["public"]["Enums"]["task_status"]
          technician_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          outage_id: string
          status?: Database["public"]["Enums"]["task_status"]
          technician_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          outage_id?: string
          status?: Database["public"]["Enums"]["task_status"]
          technician_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_tasks_outage_id_fkey"
            columns: ["outage_id"]
            isOneToOne: false
            referencedRelation: "outages"
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
    }
    Enums: {
      app_role: "admin" | "technician" | "customer"
      bill_status: "unpaid" | "paid" | "overdue" | "cancelled"
      customer_type: "residential" | "commercial" | "industrial"
      outage_severity: "low" | "medium" | "high" | "critical"
      outage_status: "reported" | "investigating" | "in_progress" | "resolved"
      task_status: "assigned" | "in_progress" | "completed"
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
      app_role: ["admin", "technician", "customer"],
      bill_status: ["unpaid", "paid", "overdue", "cancelled"],
      customer_type: ["residential", "commercial", "industrial"],
      outage_severity: ["low", "medium", "high", "critical"],
      outage_status: ["reported", "investigating", "in_progress", "resolved"],
      task_status: ["assigned", "in_progress", "completed"],
    },
  },
} as const
