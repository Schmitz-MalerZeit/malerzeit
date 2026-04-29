import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { RequireAuth } from "@/components/RequireAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import QuoteNew from "./pages/QuoteNew";
import QuoteResult from "./pages/QuoteResult";
import Quotes from "./pages/Quotes";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Legal from "./pages/Legal";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<Index />} />
            <Route path="/quote/new" element={<RequireAuth><QuoteNew /></RequireAuth>} />
            <Route path="/quote/result" element={<RequireAuth><QuoteResult /></RequireAuth>} />
            <Route path="/quotes" element={<RequireAuth><Quotes /></RequireAuth>} />
            <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
            <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
            <Route path="/legal" element={<RequireAuth><Legal /></RequireAuth>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </Toaster>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
