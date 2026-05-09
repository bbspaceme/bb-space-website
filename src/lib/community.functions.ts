import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authedMiddleware } from "@/lib/with-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getCommunityEquitySeries = createServerFn({ method: "POST" })
  .middleware(authedMiddleware)
  .inputValidator(z.object({ from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
  .handler(async ({ data }) => {
    const { data: series, error } = await supabaseAdmin
      .from("kbai_index")
      .select("date, value, pct_change, member_count")
      .gte("date", data.from_date)
      .order("date", { ascending: true });

    if (error) throw new Error(error.message);
    return series ?? [];
  });
