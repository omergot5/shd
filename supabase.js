import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://dxkxnlklqjshksjpshvv.supabase.co'
const supabaseKey = 'sb_publishable_K9gYBDA07qz9s370p1-UFw_2PcnWWor'

export const supabase = createClient(supabaseUrl, supabaseKey)
