import logo from "@/assets/malerzeit-logo.png";

export const Logo = ({ size = "md", showAi = true }: { size?: "sm" | "md" | "lg"; showAi?: boolean }) => {
  const dims = { sm: "h-8", md: "h-12", lg: "h-20" }[size];
  return (
    <div className="flex items-center gap-2">
      <img src={logo} alt="MalerZeit AI Logo" className={`${dims} w-auto object-contain`} />
      {showAi && (
        <span className="text-xs font-bold tracking-widest text-accent uppercase self-end mb-1">AI</span>
      )}
    </div>
  );
};
