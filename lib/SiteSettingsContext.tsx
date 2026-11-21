
"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { supabase } from "./supabase/client";

interface SiteSettings {
  siteName: string;
  logoUrl: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  isLoading: boolean;
}

const SiteSettingsContext = createContext<SiteSettings | undefined>(undefined);

export function SiteSettingsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [siteName, setSiteName] = useState("Lotto Dhaka");
  const [logoUrl, setLogoUrl] = useState("");
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState(
    "ওয়েবসাইটে সাময়িক রক্ষণাবেক্ষণের কাজ চলছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।"
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase.functions.invoke(
          "site-manager",
          {
            body: {
              action: "get_settings",
            },
          }
        );

        if (error) {
          console.error("Failed to load site settings:", error);
          return;
        }

        if (!data?.success || !data?.settings) {
          console.error("Invalid site settings response:", data);
          return;
        }

        if (isMounted) {
          const settings = data.settings;

          setSiteName(settings.site_name || "Lotto Dhaka");
          setLogoUrl(settings.logo_url || "");
          setMaintenanceMode(settings.maintenance_mode ?? false);
          setMaintenanceMessage(
            settings.maintenance_message ||
              "ওয়েবসাইটে সাময়িক রক্ষণাবেক্ষণের কাজ চলছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।"
          );
        }
      } catch (err) {
        console.error("Failed to load site settings:", err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <SiteSettingsContext.Provider
      value={{
        siteName,
        logoUrl,
        maintenanceMode,
        maintenanceMessage,
        isLoading,
      }}
    >
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings() {
  const context = useContext(SiteSettingsContext);

  if (!context) {
    throw new Error(
      "useSiteSettings must be used within a SiteSettingsProvider"
    );
  }

  return context;
}
