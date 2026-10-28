import { Suspense, lazy, useEffect, useState } from "react";
import CleanView from "./components/CleanView";
import { useT } from "./lib/i18n";

const World = lazy(() => import("./world/World"));

export type Mode = "clean" | "walk";
const fromHash = (): Mode => (location.hash === "#walk" ? "walk" : "clean");

export default function App() {
  const [mode, setMode] = useState<Mode>(fromHash);
  const { t } = useT();

  useEffect(() => {
    const onHash = () => setMode(fromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (m: Mode) => {
    location.hash = m === "walk" ? "walk" : "";
    setMode(m);
  };

  if (mode === "walk")
    return (
      <Suspense fallback={<div className="fixed inset-0 grid place-items-center bg-black text-sm text-white/60">{t("loading")}</div>}>
        <World onExit={() => go("clean")} />
      </Suspense>
    );
  return <CleanView onWalk={() => go("walk")} />;
}
