import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://ngxdukdmudtebykmihgw.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5neGR1a2RtdWR0ZWJ5a21paGd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2OTU3MjMsImV4cCI6MjA5MDI3MTcyM30.i4QTf0nC_zvO5YtpdXNGQPMcib_yWeMbCXz9PNsL15s"
);
