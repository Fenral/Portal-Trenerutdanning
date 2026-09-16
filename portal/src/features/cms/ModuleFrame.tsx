"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { buildModuleSrcDoc, MODULE_SANDBOX } from "./module-frame";
import type { CodeModule } from "./module-schema";
import styles from "./presentation.module.css";

export function ModuleFrame({
  module,
  className,
}: Readonly<{ module: CodeModule; className?: string }>) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(480);
  const srcDoc = useMemo(() => buildModuleSrcDoc(module), [module]);

  useEffect(() => {
    function resize(event: MessageEvent) {
      if (
        event.source !== frame.current?.contentWindow ||
        event.origin !== "null" ||
        event.data?.type !== "nivaa-module-height" ||
        event.data.id !== module.id ||
        typeof event.data.height !== "number" ||
        !Number.isFinite(event.data.height)
      ) {
        return;
      }
      setHeight(Math.min(1200, Math.max(300, event.data.height + 8)));
    }
    window.addEventListener("message", resize);
    // The srcdoc can finish before React attaches its listener after hydration.
    frame.current?.contentWindow?.postMessage(
      { type: "nivaa-request-height", id: module.id },
      "*",
    );
    return () => window.removeEventListener("message", resize);
  }, [module.id]);

  return (
    <iframe
      allow="camera 'none'; microphone 'none'; geolocation 'none'; fullscreen 'none'"
      className={[styles.moduleFrame, className].filter(Boolean).join(" ")}
      data-design-system={module.designSystem}
      data-design-version={module.designVersion}
      loading="lazy"
      onLoad={() =>
        frame.current?.contentWindow?.postMessage(
          { type: "nivaa-request-height", id: module.id },
          "*",
        )
      }
      ref={frame}
      referrerPolicy="no-referrer"
      sandbox={MODULE_SANDBOX}
      srcDoc={srcDoc}
      style={{ height }}
      title={module.title}
    />
  );
}
