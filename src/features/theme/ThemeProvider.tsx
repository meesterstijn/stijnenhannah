import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import {
  ALL_THEME_ATTRS,
  ALL_THEME_VAR_NAMES,
  ORIGINAL_SELECTION,
  composeTheme,
  presetSelection,
  type ComposedTheme,
} from "./composer";
import {
  loadCustomPresets,
  loadSelection,
  saveAppliedCache,
  saveCustomPresets,
  saveSelection,
  type CustomThemePreset,
} from "./storage";
import {
  ORIGINAL,
  isThemeExcludedPath,
  type ThemeCategory,
  type ThemeChoice,
  type ThemeSelection,
  type ThemeStyleId,
} from "./tokens";

interface ThemeContextValue {
  selection: ThemeSelection;
  // Geldt het thema op de huidige pagina? (Nee op modules met een eigen
  // vormgeving, zie THEME_EXCLUDED_PREFIXES.)
  activeHere: boolean;
  applyPreset: (id: ThemeStyleId | typeof ORIGINAL) => void;
  setCategory: (category: ThemeCategory, choice: ThemeChoice) => void;
  applySelection: (selection: ThemeSelection) => void;
  customPresets: CustomThemePreset[];
  saveCustomPreset: (name: string) => void;
  deleteCustomPreset: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyToDocument(theme: ComposedTheme | null) {
  const root = document.documentElement;
  for (const name of ALL_THEME_VAR_NAMES) root.style.removeProperty(name);
  for (const attr of ALL_THEME_ATTRS) root.removeAttribute(attr);
  if (!theme) return;
  for (const [name, value] of Object.entries(theme.vars))
    root.style.setProperty(name, value);
  for (const [attr, value] of Object.entries(theme.attrs))
    root.setAttribute(attr, value);
  for (const href of theme.fonts) {
    if (document.head.querySelector(`link[data-ht-font="${href}"]`)) continue;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.htFont = href;
    document.head.appendChild(link);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<ThemeSelection>(loadSelection);
  const [customPresets, setCustomPresets] =
    useState<CustomThemePreset[]>(loadCustomPresets);
  const { pathname } = useLocation();
  const activeHere = !isThemeExcludedPath(pathname);
  const composed = useMemo(() => composeTheme(selection), [selection]);

  // Layout-effect: toepassen vóór de browser tekent, dus geen tussenframe
  // met het oude thema bij wisselen of navigeren.
  useLayoutEffect(() => {
    applyToDocument(activeHere ? composed : null);
  }, [composed, activeHere]);

  useEffect(() => {
    saveSelection(selection);
    saveAppliedCache(composed);
  }, [selection, composed]);

  useEffect(() => saveCustomPresets(customPresets), [customPresets]);

  const applyPreset = useCallback((id: ThemeStyleId | typeof ORIGINAL) => {
    setSelection(
      id === ORIGINAL ? { ...ORIGINAL_SELECTION } : presetSelection(id),
    );
  }, []);

  const setCategory = useCallback(
    (category: ThemeCategory, choice: ThemeChoice) => {
      setSelection((prev) => ({ ...prev, [category]: choice }));
    },
    [],
  );

  const saveCustomPreset = useCallback(
    (name: string) => {
      const trimmed = name.trim().slice(0, 40);
      if (!trimmed) return;
      setCustomPresets((prev) => [
        ...prev,
        {
          id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
          name: trimmed,
          selection: { ...selection },
          createdAt: new Date().toISOString(),
        },
      ]);
    },
    [selection],
  );

  const deleteCustomPreset = useCallback((id: string) => {
    setCustomPresets((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      selection,
      activeHere,
      applyPreset,
      setCategory,
      applySelection: (next) => setSelection({ ...next }),
      customPresets,
      saveCustomPreset,
      deleteCustomPreset,
    }),
    [
      selection,
      activeHere,
      applyPreset,
      setCategory,
      customPresets,
      saveCustomPreset,
      deleteCustomPreset,
    ],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme moet binnen <ThemeProvider> staan");
  return ctx;
}
