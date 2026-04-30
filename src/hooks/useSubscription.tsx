import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";
import { useAuth } from "@/hooks/useAuth";

export interface SubscriptionState {
  loading: boolean;
  isActive: boolean;        // active subscription OR trial PDFs left
  inTrial: boolean;         // no paid plan and trial PDFs still available
  trialPdfsLeft: number;    // remaining test PDFs (0..3)
  trialPdfsLimit: number;   // total trial PDFs (= 3)
  trialPdfsUsed: number;    // used trial PDFs (lifetime)
  subscription: any | null;
  pdfLimit: number;         // monthly limit for paid plans, 0 in trial
  pdfUsed: number;          // monthly usage for paid plans
  refresh: () => Promise<void>;
}

const PDF_LIMIT_BY_PRICE: Record<string, number> = {
  starter_monthly: 15, starter_yearly: 15,
  profi_monthly: 50, profi_yearly: 50,
  profiplus_monthly: 200, profiplus_yearly: 200,
};

const TRIAL_LIMIT = 3;

export function useSubscription(): SubscriptionState {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<any | null>(null);
  const [pdfUsed, setPdfUsed] = useState(0);
  const [trialUsed, setTrialUsed] = useState(0);

  const load = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const env = getPaddleEnvironment();

    const periodStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString().slice(0, 10);

    const [{ data: subRow }, { data: usage }, { data: lifetime }] = await Promise.all([
      supabase.from("subscriptions").select("*")
        .eq("user_id", user.id).eq("environment", env)
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("pdf_usage").select("count")
        .eq("user_id", user.id).eq("period_start", periodStart).maybeSingle(),
      supabase.from("pdf_usage").select("count").eq("user_id", user.id),
    ]);

    setSub(subRow);
    setPdfUsed(usage?.count ?? 0);
    setTrialUsed((lifetime ?? []).reduce((acc: number, r: any) => acc + (r.count ?? 0), 0));
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const now = new Date();

  const subActive = sub && (
    (["active", "trialing", "past_due"].includes(sub.status) && (!sub.current_period_end || new Date(sub.current_period_end) > now))
    || (sub.status === "canceled" && sub.current_period_end && new Date(sub.current_period_end) > now)
  );

  const trialPdfsLeft = Math.max(0, TRIAL_LIMIT - trialUsed);
  const inTrial = !subActive && trialPdfsLeft > 0;
  const isActive = !!subActive || inTrial;
  const pdfLimit = sub?.price_id && subActive ? (PDF_LIMIT_BY_PRICE[sub.price_id] ?? 0) : 0;

  return {
    loading, isActive, inTrial,
    trialPdfsLeft, trialPdfsLimit: TRIAL_LIMIT, trialPdfsUsed: trialUsed,
    subscription: sub, pdfLimit, pdfUsed, refresh: load,
  };
}
