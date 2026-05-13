import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callLovableAi } from "@/lib/ai-client";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { advisorAuthMiddleware } from "@/lib/admin-middleware";
import { rateLimitMiddleware } from "@/lib/rate-limiter";

export const generateAiInsight = createServerFn({ method: "POST" })
  .middleware([
    ...advisorAuthMiddleware,
    rateLimitMiddleware((context) => `ai-insight:${context.userId}`),
  ])
  .inputValidator(z.object({}))
  .handler(async ({ context }) => {
    // User is already authenticated and authorized by advisorAuthMiddleware
    const [{ data: profiles }, { data: holdings }, { data: cash }, { data: prices }] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("id, username"),
        supabaseAdmin.from("holdings").select("*").gt("total_lot", 0),
        supabaseAdmin.from("cash_balances").select("user_id, balance"),
        supabaseAdmin
          .from("eod_prices")
          .select("ticker, close, date")
          .order("date", { ascending: false })
          .limit(5000),
      ]);

    const priceMap = new Map<string, number>();
    for (const p of prices ?? [])
      if (!priceMap.has(p.ticker)) priceMap.set(p.ticker, Number(p.close));
    const userMap = new Map((profiles ?? []).map((p) => [p.id, p.username]));
    const cashMap = new Map((cash ?? []).map((c) => [c.user_id, Number(c.balance)]));

    const userAgg = new Map<
      string,
      {
        username: string;
        positions: { ticker: string; value: number; cost: number; lot: number }[];
        total_value: number;
        total_cost: number;
        cash: number;
      }
    >();
    for (const h of holdings ?? []) {
      const last = priceMap.get(h.ticker) ?? Number(h.avg_price);
      const value = last * h.total_lot * 100;
      const cost = Number(h.avg_price) * h.total_lot * 100;
      const cur = userAgg.get(h.user_id) ?? {
        username: userMap.get(h.user_id) ?? h.user_id.slice(0, 8),
        positions: [],
        total_value: 0,
        total_cost: 0,
        cash: cashMap.get(h.user_id) ?? 0,
      };
      cur.positions.push({ ticker: h.ticker, value, cost, lot: h.total_lot });
      cur.total_value += value;
      cur.total_cost += cost;
      userAgg.set(h.user_id, cur);
    }

    // Anonymize user data before sending to AI
    const anonymizedUsers = Array.from(userAgg.values()).map((u, i) => {
      const categorizeValue = (value: number) => {
        if (value < 50_000_000) return "< 50M";
        if (value < 500_000_000) return "50M-500M";
        return "> 500M";
      };

      return {
        user_id: `USER_${i + 1}`,
        positions_count: u.positions.length,
        total_value_tier: categorizeValue(u.total_value),
        cash_ratio: u.cash / (u.total_value + u.cash),
        pl_pct:
          u.total_cost > 0 ? ((u.total_value - u.total_cost) / u.total_cost) * 100 : 0,
        top_sectors: u.positions
          .sort((a, b) => b.value - a.value)
          .slice(0, 3)
          .map((p) => p.ticker), // Only tickers, no values
      };
    });

    const usersSummary = anonymizedUsers;

    const communityAgg = new Map<string, number>();
    for (const u of userAgg.values()) {
      for (const p of u.positions) {
        communityAgg.set(p.ticker, (communityAgg.get(p.ticker) ?? 0) + p.value);
      }
    }
    const communityTotal = Array.from(communityAgg.values()).reduce((s, v) => s + v, 0);
    const topCommunity = Array.from(communityAgg.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([t, v]) => ({
        ticker: t,
        value: Math.round(v),
        pct: communityTotal > 0 ? +((v / communityTotal) * 100).toFixed(2) : 0,
      }));

    const payload = {
      community: {
        total_value: Math.round(communityTotal),
        total_users: usersSummary.length,
        top_concentrations: topCommunity,
      },
      users: usersSummary,
    };

    // Call Lovable AI
    const systemPrompt = `Kamu adalah analis investasi senior untuk komunitas KBAI (Indonesian Stock Exchange).
Berikan insight strategis dalam Bahasa Indonesia, padat dan actionable. Output dalam markdown dengan struktur:

## 🎯 AI-Assisted Allocation Recommendation
(rekomendasi alokasi berdasarkan konsentrasi & risk pasar IDX)

## ⚠️ Early Warning Risk Signal
(flag risiko: konsentrasi tinggi, sektor tunggal, cash terlalu rendah/tinggi, P/L ekstrem)

## 🔄 Auto-Rebalancing Trigger
(user/posisi mana yang perlu rebalance dan mengapa)

## 📊 Client Scorecard (Top 5)
(skor 1-10 untuk top 5 user berdasarkan: diversifikasi, P/L, cash management)

## 💡 AI Insight per Portfolio
(insight singkat untuk setiap user)`;

    const userPrompt = `Berikut data internal komunitas (JSON):\n\n${JSON.stringify(payload, null, 2)}`;

    const aiJson = await callLovableAi<{ choices?: { message?: { content?: string } }[] }>({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    const content = (aiJson as any).data?.choices?.[0]?.message?.content ?? (aiJson as any).choices?.[0]?.message?.content ?? "(no response)";
    return { content, generated_at: new Date().toISOString(), users_analyzed: usersSummary.length };
  });
