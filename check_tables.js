import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://scvdsajwsuzstagjjltg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjdmRzYWp3c3V6c3RhZ2pqbHRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxNjAzODcsImV4cCI6MjA4MjczNjM4N30._JbsT7W4NRESXqVggSE_Ahel6aXYOymPk9zlzYiMGGU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Listing tables from pg_class...");
  const { data, error } = await supabase.rpc('get_tables_list');
  console.log("RPC get_tables_list error:", error?.message || error);
  console.log("RPC get_tables_list data:", data);

  // Let's try select from information_schema
  const { data: schemaData, error: schemaError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public');
  console.log("Schema error:", schemaError?.message || schemaError);
  console.log("Schema data:", schemaData);
}

run();
