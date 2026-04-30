import { Link } from "react-router-dom";
import logo from "@/assets/malerzeit-logo.png";

export const Logo = ({
  size = "md",
  showAi = true,
  linkToHome = true,
}: {
  size?: "sm" | "md" | "lg";
  showAi?: boolean;
  linkToHome?: boolean;
}) => {
  const dims = { sm: "h-12", md: "h-16", lg: "h-24" }[size];
  const inner = (
    <div className="flex items-center gap-2">
      <img src={logo} alt="MalerZeit AI Logo" className={`${dims} w-auto object-contain`} />
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
