
"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSiteSettings } from "../lib/SiteSettingsContext";

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
    if (isLoading || !maintenanceMode) return;

    // সম্পূর্ণ Admin Route Maintenance Redirect থেকে মুক্ত।
    if (isAdminPage) return;

    // Maintenance এবং User Login Page প্রবেশযোগ্য থাকবে।
    if (isMaintenancePage || isLoginPage) return;

    window.location.replace(
      `${BASE_PATH}/maintenance/`
    );
  }, [
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

  if (isAdminPage) {
    return <>{children}</>;
  }

  if (isMaintenancePage || isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#07130e] text-white">
      Loading Maintenance Page...
    </div>
  );
}
