import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireSubscription } from "@/components/RequireSubscription";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import QuoteNew from "./pages/QuoteNew";
import QuoteResult from "./pages/QuoteResult";
import Quotes from "./pages/Quotes";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Legal from "./pages/Legal";
import Terms from "./pages/Terms";
import Refund from "./pages/Refund";
import Privacy from "./pages/Privacy";
import Pricing from "./pages/Pricing";
import Billing from "./pages/Billing";
import PdfActionView from "./pages/PdfActionView";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <PaymentTestModeBanner />
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/refund" element={<Refund />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/" element={<Index />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/billing" element={<RequireAuth><Billing /></RequireAuth>} />
            <Route path="/quote/new" element={<RequireAuth><RequireSubscription><QuoteNew /></RequireSubscription></RequireAuth>} />
            <Route path="/quote/result" element={<RequireAuth><RequireSubscription><QuoteResult /></RequireSubscription></RequireAuth>} />
            <Route path="/quotes" element={<RequireAuth><Quotes /></RequireAuth>} />
            <Route path="/pdf-action" element={<RequireAuth><PdfActionView /></RequireAuth>} />
            <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
            <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
            <Route path="/legal" element={<RequireAuth><Legal /></RequireAuth>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
