
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

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from("site_settings")
          .select(
            "site_name, logo_url, maintenance_mode, maintenance_message"
          )
          .eq("id", 1)
          .single();

        if (error) {
          console.error("Failed to load site settings:", error);
          return;
        }

        if (data) {
          setSiteName(data.site_name || "Lotto Dhaka");
          setLogoUrl(data.logo_url || "");
          setMaintenanceMode(data.maintenance_mode ?? false);
          setMaintenanceMessage(
            data.maintenance_message ||
              "ওয়েবসাইটে সাময়িক রক্ষণাবেক্ষণের কাজ চলছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।"
          );
        }
      } catch (err) {
        console.error("Failed to load site settings:", err);
      }
    };

    fetchSettings();
  }, []);

  return (
    <SiteSettingsContext.Provider
      value={{
        siteName,
        logoUrl,
        maintenanceMode,
        maintenanceMessage,
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
