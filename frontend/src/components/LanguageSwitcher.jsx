import { useTranslation } from "react-i18next";
import { Globe, Check } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { SUPPORTED_LANGS } from "@/i18n";

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = SUPPORTED_LANGS.find((l) => l.code === i18n.language) || SUPPORTED_LANGS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-testid="lang-switcher"
        className="inline-flex items-center gap-1.5 text-sm text-[#4A5D68] hover:text-[#0B2B40] transition-colors px-2 py-1 rounded"
      >
        <Globe className="h-4 w-4" />
        <span className="font-medium">{current.label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        {SUPPORTED_LANGS.map((l) => (
          <DropdownMenuItem
            key={l.code}
            data-testid={`lang-option-${l.code}`}
            onClick={() => i18n.changeLanguage(l.code)}
            className="flex items-center justify-between"
          >
            <span>{l.name}</span>
            {l.code === current.code && <Check className="h-3.5 w-3.5 text-[#E05D43]" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
