
import { createClient } from "../supabase/client";

export async function checkAdminAccess() {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { allowed: false, reason: "not_logged_in" };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_role, account_status")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return { allowed: false, reason: "profile_not_found" };
    }

    const allowedRoles = ["admin", "super_admin"];

    if (
      !allowedRoles.includes(profile.user_role) ||
      profile.account_status !== "active"
    ) {
      return { allowed: false, reason: "admin_access_denied" };
    }

    return {
      allowed: true,
      reason: "admin_verified",
      role: profile.user_role,
    };
  } catch {
    return { allowed: false, reason: "verification_failed" };
  }
}
