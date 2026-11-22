
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useSiteSettings } from "../lib/SiteSettingsContext";
import { createClient } from "../lib/supabase/client";

const BASE_PATH = "/Next-Js-Web-x";
const ADMIN_PATH = "/admin-panel-rakib-aiman-tushar";

function normalizePath(path: string) {
  let result = path.split("?")[0].toLowerCase();

  const basePath = BASE_PATH.toLowerCase();

  if (
    result === basePath ||
    result.startsWith(basePath + "/")
  ) {
    result = result.slice(basePath.length);
  }

  result = result.replace(/\/+$/, "");

  if (!result.startsWith("/")) {
    result = "/" + result;
  }

  return result || "/";
}

export default function MaintenanceGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const { maintenanceMode, isLoading } = useSiteSettings();

  const supabase = useMemo(() => createClient(), []);

  const [checkingSuperAdmin, setCheckingSuperAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const currentPath = normalizePath(pathname || "/");

  const isAdminPage =
    currentPath === ADMIN_PATH ||
    currentPath.startsWith(ADMIN_PATH + "/");

  const isMaintenancePage =
    currentPath === "/maintenance" ||
    currentPath.startsWith("/maintenance/");

  const isLoginPage =
    currentPath === "/client/login" ||
    currentPath.startsWith("/client/login/");

  useEffect(() => {
    if (
      isLoading ||
      !maintenanceMode ||
      isAdminPage ||
      isMaintenancePage ||
      isLoginPage
    ) {
      setCheckingSuperAdmin(false);
      setIsSuperAdmin(false);
      return;
    }

    let isActive = true;

    setCheckingSuperAdmin(true);
    setIsSuperAdmin(false);

    async function verifySuperAdmin() {
      let allowed = false;

      try {
        const {
          data: sessionData,
          error: sessionError,
        } = await supabase.auth.getSession();

        const session = sessionData?.session;

        if (session && !sessionError) {
          const {
            data: profile,
            error: profileError,
          } = await supabase
            .from("profiles")
            .select("user_role, account_status")
            .eq("id", session.user.id)
            .maybeSingle();

          allowed =
            !profileError &&
            profile?.user_role === "super_admin" &&
            profile?.account_status === "active";
        }
      } catch {
        allowed = false;
      }

      if (!isActive) return;

      setIsSuperAdmin(allowed);
      setCheckingSuperAdmin(false);

      if (!allowed) {
        window.location.replace(
          `${BASE_PATH}/maintenance/`
        );
      }
    }

    verifySuperAdmin();

    return () => {
      isActive = false;
    };
  }, [
    supabase,
    isLoading,
    maintenanceMode,
    isAdminPage,
    isMaintenancePage,
    isLoginPage,
  ]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#07130e] text-white">
        Loading...
      </div>
    );
  }

  if (!maintenanceMode) {
    return <>{children}</>;
  }

  // Admin Panel সবার জন্য Maintenance Redirect থেকে মুক্ত।
  // Admin Panel-এর নিজস্ব Role Verification আগের মতো থাকবে।
  if (isAdminPage) {
    return <>{children}</>;
  }

  // Maintenance এবং Login Page প্রবেশযোগ্য থাকবে।
  if (isMaintenancePage || isLoginPage) {
    return <>{children}</>;
  }

  // Super Admin যাচাই চলাকালীন অপেক্ষা করবে।
  if (checkingSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#07130e] text-white">
        Verifying Super Admin...
      </div>
    );
  }

  // যাচাইকৃত Super Admin সম্পূর্ণ Public Website দেখতে পারবে।
  if (isSuperAdmin) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#07130e] text-white">
      Loading Maintenance Page...
    </div>
  );
}
