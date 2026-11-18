
import { createClient } from "../supabase/client";

export async function checkAdminAccess() {
  try {
    const supabase = createClient();

    // Verify the currently logged-in user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        allowed: false,
        reason: "not_logged_in",
      };
    }

    // Verify the user's role in the profiles table
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_role, account_status")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return {
        allowed: false,
        reason: "profile_not_found",
      };
    }

    if (
      profile.user_role !== "admin" ||
      profile.account_status !== "active"
    ) {
      return {
        allowed: false,
        reason: "admin_access_denied",
      };
    }

    return {
      allowed: true,
      reason: "admin_verified",
    };
  } catch {
    return {
      allowed: false,
      reason: "verification_failed",
    };
  }
}
