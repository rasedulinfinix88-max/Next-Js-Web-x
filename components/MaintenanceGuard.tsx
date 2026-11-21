
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabase/client";
import { useSiteSettings } from "../lib/SiteSettingsContext";

const BASE_PATH = "/Next-Js-Web-x";

const ADMIN_PATH =
  "/admin-panel-rakib-aiman-tushar/maintenance-for-faster";

function normalizePath(path: string) {
  let result = path.split("?")[0].toLowerCase();

  const basePath = BASE_PATH.toLowerCase().replace(/\/+$/, "");

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
  const router = useRouter();

  const { maintenanceMode, isLoading } = useSiteSettings();

  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  const currentPath = normalizePath(pathname || "/");

  const isMaintenancePage =
    currentPath === "/maintenance" ||
    currentPath.startsWith("/maintenance/");

  const isLoginPage =
    currentPath === "/client/login" ||
    currentPath.startsWith("/client/login/");

  const isAdminPage =
    currentPath === ADMIN_PATH ||
    currentPath.startsWith(ADMIN_PATH + "/");

  // Verify active admin or super_admin
  useEffect(() => {
    let active = true;

    if (!maintenanceMode || !isAdminPage) {
      setCheckingAdmin(false);
      setIsAdmin(false);

      return () => {
        active = false;
      };
    }

    setCheckingAdmin(true);
    setIsAdmin(false);

    async function verifyAdmin() {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.user?.id) {
          if (active) {
            setIsAdmin(false);
            setCheckingAdmin(false);
          }
          return;
        }

        const { data: profile, error: profileError } =
          await supabase
            .from("profiles")
            .select("user_role, account_status")
            .eq("id", session.user.id)
            .maybeSingle();

        if (!active) return;

        const authorized =
          !profileError &&
          profile?.account_status === "active" &&
          ["admin", "super_admin"].includes(profile?.user_role);

        setIsAdmin(authorized);
        setCheckingAdmin(false);

      } catch {
        if (active) {
          setIsAdmin(false);
          setCheckingAdmin(false);
        }
      }
    }

    verifyAdmin();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      if (!active) return;

      setCheckingAdmin(true);

      Promise.resolve().then(() => {
        if (active) verifyAdmin();
      });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [maintenanceMode, isAdminPage]);

  // Redirect unauthorized visitors
  useEffect(() => {
    if (isLoading || !maintenanceMode) return;

    if (isMaintenancePage || isLoginPage) return;

    if (isAdminPage && checkingAdmin) return;

    if (isAdminPage && isAdmin) return;

    // Next.js automatically handles the configured basePath.
    router.replace("/maintenance/");
  }, [
    isLoading,
    maintenanceMode,
    isMaintenancePage,
    isLoginPage,
    isAdminPage,
    checkingAdmin,
    isAdmin,
    router,
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

  if (isMaintenancePage || isLoginPage) {
    return <>{children}</>;
  }

  if (isAdminPage && checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#07130e] text-white">
        Verifying Admin...
      </div>
    );
  }

  if (isAdminPage && isAdmin) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#07130e] text-white">
      Loading Maintenance Page...
    </div>
  );
}
