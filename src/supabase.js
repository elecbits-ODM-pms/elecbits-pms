import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://ccmdtzipfeftuicnkrnl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjbWR0emlwZmVmdHVpY25rcm5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1ODM4MjIsImV4cCI6MjA5MDE1OTgyMn0.XRZy8vTt8zqOqv-CxVf8dqb-JAq54H69tC5ngmLzSCY'
)