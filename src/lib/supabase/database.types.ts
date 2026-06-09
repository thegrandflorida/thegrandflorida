// Auto-generated Supabase types placeholder.
// Replace this file by running:
//   npx supabase gen types typescript --project-id YOUR_PROJECT_ID \
//     > src/lib/supabase/database.types.ts
//
// The permissive row types below keep the codebase compiling until the real
// types are generated from your live Supabase project.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>

export type Database = {
  public: {
    Tables: {
      [key: string]: {
        Row: AnyRow
        Insert: AnyRow
        Update: AnyRow
        Relationships: []
      }
    }
    Views: {
      [key: string]: {
        Row: AnyRow
        Relationships: []
      }
    }
    Functions: {
      [key: string]: {
        Args: AnyRow
        Returns: AnyRow
      }
    }
    Enums: {
      [key: string]: string
    }
    CompositeTypes: {
      [key: string]: AnyRow
    }
  }
}
