import type { CSSProperties, ReactNode } from "react";
import { nameColorStyle, type NameColorId } from "../nameColors";

interface ColoredNameProps {
  name: string;
  colorId?: NameColorId | string | null;
  className?: string;
  style?: CSSProperties;
  as?: "span" | "p" | "button";
  children?: ReactNode;
  title?: string;
  onClick?: () => void;
  type?: "button";
}

/** Tên người chơi với màu / gradient do RoleAD gán. */
export function ColoredName({
  name,
  colorId,
  className = "",
  style,
  as = "span",
  title,
  onClick,
  type,
}: ColoredNameProps) {
  const colorStyle = nameColorStyle(colorId);
  const merged = { ...colorStyle, ...style };
  const cls = `colored-name ${className}`.trim();

  if (as === "button") {
    return (
      <button
        type={type ?? "button"}
        className={cls}
        style={merged}
        title={title}
        onClick={onClick}
      >
        {name}
      </button>
    );
  }
  if (as === "p") {
    return (
      <p className={cls} style={merged} title={title}>
        {name}
      </p>
    );
  }
  return (
    <span className={cls} style={merged} title={title}>
      {name}
    </span>
  );
}
