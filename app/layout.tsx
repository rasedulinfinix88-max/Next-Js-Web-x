
import type { Metadata, Viewport } from "next";
import "./globals.css";

import { LanguageProvider } from "../lib/LanguageContext";
import { SiteSettingsProvider } from "../lib/SiteSettingsContext";

export const metadata: Metadata = {
  title: {
    default: "Next-Js-Web-x",
    template: "%s | Next-Js-Web-x",
  },
  description: "Welcome to Next-Js-Web-x",
  applicationName: "Next-Js-Web-x",
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#184f35",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          <SiteSettingsProvider>
            {children}
          </SiteSettingsProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
