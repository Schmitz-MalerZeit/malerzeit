import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";
import { useAuth } from "@/hooks/useAuth";

export interface SubscriptionState {
  loading: boolean;
  isActive: boolean;        // active subscription OR trial
  inTrial: boolean;
  trialEndsAt: Date | null;
  trialDaysLeft: number;
  subscription: any | null;
  pdfLimit: number;
  pdfUsed: number;
  refresh: () => Promise<void>;
}

const PDF_LIMIT_BY_PRICE: Record<string, number> = {
  starter_monthly: 15, starter_yearly: 15,
  profi_monthly: 50, profi_yearly: 50,
  profiplus_monthly: 200, profiplus_yearly: 200,
};

export function useSubscription(): SubscriptionState {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<any | null>(null);
  const [trialEndsAt, setTrialEndsAt] = useState<Date | null>(null);
  const [pdfUsed, setPdfUsed] = useState(0);

  const load = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const env = getPaddleEnvironment();

    const [{ data: subRow }, { data: prof }, { data: usage }] = await Promise.all([
      supabase.from("subscriptions").select("*")
        .eq("user_id", user.id).eq("environment", env)
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("profiles").select("trial_ends_at").eq("id", user.id).maybeSingle(),
      supabase.from("pdf_usage").select("count")
        .eq("user_id", user.id)
        .eq("period_start", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
        .maybeSingle(),
    ]);

    setSub(subRow);
    setTrialEndsAt(prof?.trial_ends_at ? new Date(prof.trial_ends_at) : null);
    setPdfUsed(usage?.count ?? 0);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const now = new Date();
  const inTrial = !!trialEndsAt && trialEndsAt > now && (!sub || sub.status === "canceled");
  const trialDaysLeft = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86400000)) : 0;

  const subActive = sub && (
    (["active", "trialing", "past_due"].includes(sub.status) && (!sub.current_period_end || new Date(sub.current_period_end) > now))
    || (sub.status === "canceled" && sub.current_period_end && new Date(sub.current_period_end) > now)
  );

  const isActive = !!subActive || inTrial;
  const pdfLimit = sub?.price_id ? (PDF_LIMIT_BY_PRICE[sub.price_id] ?? 0) : (inTrial ? 50 : 0);

  return { loading, isActive, inTrial, trialEndsAt, trialDaysLeft, subscription: sub, pdfLimit, pdfUsed, refresh: load };
}
