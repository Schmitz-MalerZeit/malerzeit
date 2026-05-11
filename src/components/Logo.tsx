import { Link } from "react-router-dom";
import logo from "@/assets/malerzeit-logo.webp";

export const Logo = ({
  size = "md",
  showAi = true,
  linkToHome = true,
}: {
  size?: "sm" | "md" | "lg";
  showAi?: boolean;
  linkToHome?: boolean;
}) => {
  const cfg = {
    sm: { cls: "h-12", w: 88, h: 48 },
    md: { cls: "h-16", w: 117, h: 64 },
    lg: { cls: "h-24", w: 176, h: 96 },
  }[size];
  const inner = (
    <div className="flex items-center gap-2">
      <img
        src={logo}
        alt="MalerZeit AI Logo"
        width={cfg.w}
        height={cfg.h}
        fetchPriority="high"
        decoding="async"
        className={`${cfg.cls} w-auto object-contain`}
      />
      {showAi && (
        <span className="text-xs font-bold tracking-widest text-accent uppercase self-end mb-1.5">AI</span>
      )}
    </div>
  );
  if (!linkToHome) return inner;
  return (
    <Link to="/" aria-label="Zur Startseite" className="rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
      {inner}
    </Link>
  );
};
