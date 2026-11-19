"use client";

import { useEffect, useState } from "react";
import { AppHeader, type StaffMode } from "./AppHeader";
import { QAGeneratorApp } from "./QAGeneratorApp";
import { DiagramApp } from "./DiagramApp";

const HASH: Record<StaffMode, string> = { qa: "", diagrams: "#diagrams" };

/** Both tools stay mounted, so a running batch keeps going while the other one is in view. */
export function StaffApp() {
  const [mode, setMode] = useState<StaffMode>("qa");

  useEffect(() => {
    if (window.location.hash === HASH.diagrams) setMode("diagrams");
  }, []);

  const changeMode = (m: StaffMode) => {
    setMode(m);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${HASH[m]}`);
  };

  const header = <AppHeader mode={mode} onModeChange={changeMode} />;
  return (
    <>
      <div style={{ display: mode === "qa" ? "block" : "none" }}>
        <QAGeneratorApp header={header} />
      </div>
      <div style={{ display: mode === "diagrams" ? "block" : "none" }}>
        <DiagramApp header={header} />
      </div>
    </>
  );
}
