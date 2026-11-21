
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabase/client";
import { useSiteSettings } from "../lib/SiteSettingsContext";

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

  const currentPath = pathname.toLowerCase();

  const isMaintenancePage =
    currentPath === "/maintenance" ||
    currentPath.startsWith("/maintenance/");

  const isLoginPage =
    currentPath === "/client/login" ||
    currentPath.startsWith("/client/login/");

  const isAdminPage =
    currentPath ===
      "/admin-panel-rakib-aiman-tushar/maintenance-for-faster" ||
    currentPath.startsWith(
      "/admin-panel-rakib-aiman-tushar/maintenance-for-faster/"
    );

  // Verify active admin or super_admin
  useEffect(() => {
    if (!maintenanceMode || !isAdminPage) {
      setCheckingAdmin(false);
      setIsAdmin(false);
      return;
    }

    let active = true;

    const verifyAdmin = async (userId: string | null) => {
      if (!userId) {
        if (active) {
          setIsAdmin(false);
          setCheckingAdmin(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("user_role, account_status")
        .eq("id", userId)
        .maybeSingle();

      if (active) {
        setIsAdmin(
          !error &&
            data?.account_status === "active" &&
            ["admin", "super_admin"].includes(data?.user_role)
        );

        setCheckingAdmin(false);
      }
    };

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        verifyAdmin(null);
        return;
      }

      verifyAdmin(data.session?.user?.id ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCheckingAdmin(true);
      verifyAdmin(session?.user?.id ?? null);
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

    router.replace("/maintenance");
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

  // Wait for settings
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#07130e] text-white">
        Loading...
      </div>
    );
  }

  // Normal website
  if (!maintenanceMode) {
    return <>{children}</>;
  }

  // Maintenance page and login page remain accessible
  if (isMaintenancePage || isLoginPage) {
    return <>{children}</>;
  }

  // Only verified active admins can access Admin Panel
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
