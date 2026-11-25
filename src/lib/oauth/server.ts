import "server-only"

import { createOauthService } from "@/lib/oauth/service"
import { supabaseOauthStore } from "@/lib/oauth/supabase-store"

export function getOauthService() {
  return createOauthService(supabaseOauthStore)
}
