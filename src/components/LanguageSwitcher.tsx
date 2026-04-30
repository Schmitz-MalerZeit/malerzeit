import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { SUPPORTED_LANGUAGES } from "@/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  variant?: "icon" | "compact";
}

export function LanguageSwitcher({ variant = "icon" }: Props) {
  const { i18n, t } = useTranslation();
  const current =
    SUPPORTED_LANGUAGES.find((l) => l.code === i18n.resolvedLanguage) ??
    SUPPORTED_LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("common.language")}
        className="h-10 px-3 rounded-lg border border-border bg-background hover:bg-secondary transition-base flex items-center gap-2 text-sm font-medium"
      >
        <Globe className="h-4 w-4" />
        {variant === "compact" ? (
          <span className="uppercase tracking-wide text-xs">{current.code}</span>
        ) : (
          <span>{current.label}</span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SUPPORTED_LANGUAGES.map((lng) => (
          <DropdownMenuItem
            key={lng.code}
            onClick={() => i18n.changeLanguage(lng.code)}
            className={i18n.resolvedLanguage === lng.code ? "font-semibold" : ""}
          >
            {lng.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
