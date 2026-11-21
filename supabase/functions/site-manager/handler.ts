
// @ts-nocheck

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("PROJECT_URL") ?? "";
const serviceRoleKey = Deno.env.get("PROJECT_SERVICE_KEY") ?? "";
const anonKey = Deno.env.get("PROJECT_ANON_KEY") ?? "";

const publicFields =
  "site_name, logo_url, maintenance_mode, maintenance_message, updated_at";

function response(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return response({ error: "Method not allowed" }, 405);
  }

  try {
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return response(
        { error: "Supabase environment configuration is missing" },
        500
      );
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const body = await req.json();
    const action = String(body.action ?? "");

    // =====================================
    // GET PUBLIC SITE SETTINGS
    // =====================================

    if (action === "get_settings") {
      const { data, error } = await supabaseAdmin
        .from("site_settings")
        .select(publicFields)
        .eq("id", 1)
        .single();

      if (error) throw error;

      return response({
        success: true,
        settings: data,
      });
    }

    // =====================================
    // AUTHENTICATE ADMIN
    // =====================================

    if (action === "update_settings") {
      const authHeader = req.headers.get("Authorization");

      if (!authHeader?.startsWith("Bearer ")) {
        return response(
          { error: "Authentication required" },
          401
        );
      }

      const token = authHeader.slice(7).trim();

      if (!token) {
        return response(
          { error: "Invalid authentication token" },
          401
        );
      }

      const supabaseUser = createClient(
        supabaseUrl,
        anonKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );

      const {
        data: { user },
        error: authError,
      } = await supabaseUser.auth.getUser(token);

      if (authError || !user) {
        return response(
          { error: "Invalid or expired session" },
          401
        );
      }

      // Verify role from database
      const { data: profile, error: profileError } =
        await supabaseAdmin
          .from("profiles")
          .select("id, user_role, account_status")
          .eq("id", user.id)
          .single();

      if (profileError || !profile) {
        return response(
          { error: "User profile not found" },
          403
        );
      }

      if (
        profile.account_status !== "active" ||
        !["admin", "super_admin"].includes(profile.user_role)
      ) {
        return response(
          { error: "Admin permission required" },
          403
        );
      }

      // =====================================
      // VALIDATE SETTINGS
      // =====================================

      const updates: Record<string, any> = {};

      if (body.site_name !== undefined) {
        if (
          typeof body.site_name !== "string" ||
          !body.site_name.trim() ||
          body.site_name.trim().length > 100
        ) {
          return response(
            { error: "Invalid website name" },
            400
          );
        }

        updates.site_name = body.site_name.trim();
      }

      if (body.logo_url !== undefined) {
        if (body.logo_url === null || body.logo_url === "") {
          updates.logo_url = null;
        } else {
          if (typeof body.logo_url !== "string") {
            return response(
              { error: "Invalid logo URL" },
              400
            );
          }

          try {
            const logoUrl = new URL(body.logo_url);

            if (logoUrl.protocol !== "https:") {
              return response(
                { error: "Logo URL must use HTTPS" },
                400
              );
            }

            updates.logo_url = logoUrl.toString();
          } catch {
            return response(
              { error: "Invalid logo URL" },
              400
            );
          }
        }
      }

      if (body.maintenance_mode !== undefined) {
        if (typeof body.maintenance_mode !== "boolean") {
          return response(
            { error: "Invalid maintenance mode value" },
            400
          );
        }

        updates.maintenance_mode = body.maintenance_mode;
      }

      if (body.maintenance_message !== undefined) {
        if (
          typeof body.maintenance_message !== "string" ||
          !body.maintenance_message.trim() ||
          body.maintenance_message.length > 2000
        ) {
          return response(
            { error: "Invalid maintenance message" },
            400
          );
        }

        updates.maintenance_message =
          body.maintenance_message.trim();
      }

      if (Object.keys(updates).length === 0) {
        return response(
          { error: "No valid settings provided" },
          400
        );
      }

      // =====================================
      // UPDATE USING AUTHENTICATED USER
      // RLS verifies admin permission again
      // =====================================

      const supabaseUserUpdate = createClient(
        supabaseUrl,
        anonKey,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );

      const { data: updatedSettings, error: updateError } =
        await supabaseUserUpdate
          .from("site_settings")
          .update(updates)
          .eq("id", 1)
          .select(publicFields)
          .single();

      if (updateError) throw updateError;

      return response({
        success: true,
        message: "Site settings updated successfully",
        settings: updatedSettings,
      });
    }

    return response(
      { error: "Invalid action" },
      400
    );

  } catch (error) {
    console.error("Site Manager Error:", error);

    return response(
      { error: "Internal server error" },
      500
    );
  }
});
