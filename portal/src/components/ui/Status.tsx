import type { PropsWithChildren } from "react";

export type StatusTone = "success" | "warning" | "error" | "info";

const iconPaths: Readonly<Record<StatusTone, string>> = {
  success: "M4.5 10.2 8 13.5 15.5 5.8",
  warning: "M10 3.2 17 16H3L10 3.2Zm0 4.3v4.2m0 2.2v.1",
  error: "M10 3.2 17 16H3L10 3.2Zm0 4.3v4.2m0 2.2v.1",
  info: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm0-7v4m0-7v.1",
};

export function Status({
  tone,
  children,
}: PropsWithChildren<{ tone: StatusTone; children: string }>) {
  return (
    <span
      aria-label={children}
      className={`nivaa-status nivaa-status--${tone}`}
      role="status"
    >
      <svg aria-hidden="true" viewBox="0 0 20 20">
        <path d={iconPaths[tone]} />
      </svg>
      <span>{children}</span>
    </span>
  );
}
