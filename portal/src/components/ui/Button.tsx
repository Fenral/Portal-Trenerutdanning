import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

export type ButtonPriority = "primary" | "secondary" | "quiet";

export type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    priority?: ButtonPriority;
  }
>;

export function Button({
  priority = "secondary",
  type = "button",
  className,
  children,
  ...props
}: ButtonProps) {
  const classes = ["nivaa-button", `nivaa-button--${priority}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} data-priority={priority} type={type} {...props}>
      {children}
    </button>
  );
}
