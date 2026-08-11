import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "te";

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (en: string, te: string) => string };

const LanguageContext = createContext<Ctx>({
  lang: "en",
  setLang: () => {},
  t: (en) => en,
});

// v2: resets any previously stored Telugu preference so every visitor starts
// on the English interface.
const STORAGE_KEY = "batt-lang-v2";

export function LanguageProvider({ children }: { children: ReactNode }) {
  // English-first default keeps the site readable for Telugu speakers who
  // cannot read the script. Stored preference is applied after hydration.
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "te" || saved === "en") setLangState(saved);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    window.localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const t = useCallback((en: string, te: string) => (lang === "te" ? te : en), [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}

/** English-first bilingual label: Telugu is always the smaller line underneath. */
export function Bilingual({ en, te, hint = true }: { en: string; te: string; hint?: boolean }) {
  return (
    <span className="inline-flex min-w-0 flex-col items-start justify-center leading-tight">
      <span>{en}</span>
      {hint && (
        <span className="te-text mt-0.5 text-[10px] font-normal text-muted-foreground">{te}</span>
      )}
    </span>
  );
}

export function LangToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div
      className={`inline-flex overflow-hidden rounded-sm border border-border ${className}`}
      role="group"
      aria-label="Site language"
    >
      {(["en", "te"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`min-h-11 px-3 text-xs font-semibold transition-colors sm:min-h-0 sm:py-1.5 ${
            lang === l
              ? "bg-primary text-primary-foreground"
              : "bg-background text-ink hover:text-primary"
          }`}
        >
          {l === "en" ? "English" : "తెలుగు"}
        </button>
      ))}
    </div>
  );
}
