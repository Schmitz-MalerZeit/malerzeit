import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Home from "./Home";
import { Seo } from "@/components/Seo";
import { Loader2 } from "lucide-react";

export default function Index() {
  const { user, loading } = useAuth();
  return (
    <>
      <Seo
        title="MalerZeit AI – Preisvorschläge für Malerbetriebe in Minuten"
        description="KI-gestützte Preisvorschläge für Malerbetriebe: Tätigkeit beschreiben, kalkulieren und ein professionelles PDF erstellen – direkt vom Smartphone."
        path="/"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "MalerZeit AI",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web, iOS, Android",
          url: "https://malerzeit-ai.de",
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "EUR",
            lowPrice: "14.90",
            highPrice: "34.95",
          },
        }}
      />
      {loading ? (
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !user ? (
        <Navigate to="/auth" replace />
      ) : (
        <Home />
      )}
    </>
  );
}
