export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string
          name: string
          created_at: string
          created_by: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          created_by: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          created_by?: string
        }
      }
      workspace_members: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          role: 'owner' | 'admin' | 'contributor'
          can_set_priority_p0: boolean
          can_manage_dues: boolean
          can_manage_bookings: boolean
          can_manage_members: boolean
          can_add_shopping: boolean
          can_check_shopping: boolean
          can_write_shopping: boolean
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          role?: 'owner' | 'admin' | 'contributor'
          can_set_priority_p0?: boolean
          can_manage_dues?: boolean
          can_manage_bookings?: boolean
          can_manage_members?: boolean
          can_add_shopping?: boolean
          can_check_shopping?: boolean
          can_write_shopping?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          role?: 'owner' | 'admin' | 'contributor'
          can_set_priority_p0?: boolean
          can_manage_dues?: boolean
          can_manage_bookings?: boolean
          can_manage_members?: boolean
          can_add_shopping?: boolean
          can_check_shopping?: boolean
          can_write_shopping?: boolean
          created_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          workspace_id: string
          name: string
          color: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          color?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          color?: string | null
          created_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          workspace_id: string
          title: string
          description: string | null
          status: 'inbox' | 'next' | 'waiting' | 'scheduled' | 'done'
          priority: 'P0' | 'P1' | 'P2'
          next_step: string | null
          time_estimate_min: number | null
          due_at: string | null
          waiting_for: string | null
          energy_level: 'low' | 'medium' | 'high' | null
          category_id: string | null
          assigned_to: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          title: string
          description?: string | null
          status?: 'inbox' | 'next' | 'waiting' | 'scheduled' | 'done'
          priority?: 'P0' | 'P1' | 'P2'
          next_step?: string | null
          time_estimate_min?: number | null
          due_at?: string | null
          waiting_for?: string | null
          energy_level?: 'low' | 'medium' | 'high' | null
          category_id?: string | null
          assigned_to?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          title?: string
          description?: string | null
          status?: 'inbox' | 'next' | 'waiting' | 'scheduled' | 'done'
          priority?: 'P0' | 'P1' | 'P2'
          next_step?: string | null
          time_estimate_min?: number | null
          due_at?: string | null
          waiting_for?: string | null
          energy_level?: 'low' | 'medium' | 'high' | null
          category_id?: string | null
          assigned_to?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      notes: {
        Row: {
          id: string
          workspace_id: string
          headline: string | null
          body: string
          category_id: string | null
          task_id: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          headline?: string | null
          body: string
          category_id?: string | null
          task_id?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          headline?: string | null
          body?: string
          category_id?: string | null
          task_id?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      dues: {
        Row: {
          id: string
          workspace_id: string
          payee: string
          amount: number
          currency: string
          due_date: string
          status: 'pending' | 'paid' | 'overdue'
          reference: string | null
          category_id: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          payee: string
          amount: number
          currency?: string
          due_date: string
          status?: 'pending' | 'paid' | 'overdue'
          reference?: string | null
          category_id?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          payee?: string
          amount?: number
          currency?: string
          due_date?: string
          status?: 'pending' | 'paid' | 'overdue'
          reference?: string | null
          category_id?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      shopping_lists: {
        Row: {
          id: string
          workspace_id: string
          title: string
          created_by: string
          created_at: string
          archived_at: string | null
        }
        Insert: {
          id?: string
          workspace_id: string
          title?: string
          created_by: string
          created_at?: string
          archived_at?: string | null
        }
        Update: {
          id?: string
          workspace_id?: string
          title?: string
          created_by?: string
          created_at?: string
          archived_at?: string | null
        }
      }
      shopping_items: {
        Row: {
          id: string
          workspace_id: string
          list_id: string
          name: string
          is_checked: boolean
          checked_by: string | null
          checked_at: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          list_id: string
          name: string
          is_checked?: boolean
          checked_by?: string | null
          checked_at?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          list_id?: string
          name?: string
          is_checked?: boolean
          checked_by?: string | null
          checked_at?: string | null
          created_by?: string
          created_at?: string
        }
      }
    }
    Functions: {
      create_workspace: {
        Args: {
          p_name: string
        }
        Returns: string
      }
      add_member_contributor: {
        Args: {
          p_workspace_id: string
          p_user_id: string
          p_can_set_p0: boolean
        }
        Returns: void
      }
      get_shopping_suggestions: {
        Args: {
          p_workspace_id: string
          p_prefix: string
          p_limit?: number
        }
        Returns: {
          name: string
          name_norm: string
          last_seen_at: string
          times_used: number
        }[]
      }
    }
  }
}
