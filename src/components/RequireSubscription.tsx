import { Navigate, useLocation } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export const RequireSubscription = ({ children }: { children: JSX.Element }) => {
  const { loading: authLoading } = useAuth();
  const sub = useSubscription();
  const loc = useLocation();

  if (authLoading || sub.loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!sub.isActive) return <Navigate to="/pricing" replace state={{ from: loc }} />;
  return children;
};
