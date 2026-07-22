import type { CSSProperties, ReactNode } from "react";
import {
  nameColorStyle,
  normalizeNameEffect,
  type NameColorId,
  type NameEffectId,
} from "../nameColors";

interface ColoredNameProps {
  name: string;
  colorId?: NameColorId | string | null;
  effectId?: NameEffectId | string | null;
  className?: string;
  style?: CSSProperties;
  as?: "span" | "p" | "button";
  children?: ReactNode;
  title?: string;
  onClick?: () => void;
  type?: "button";
}

/** Tên người chơi với màu / gradient / hiệu ứng chữ do RoleAD gán. */
export function ColoredName({
  name,
  colorId,
  effectId,
  className = "",
  style,
  as = "span",
  title,
  onClick,
  type,
}: ColoredNameProps) {
  const colorStyle = nameColorStyle(colorId, effectId);
  const fx = normalizeNameEffect(effectId);
  const merged = { ...colorStyle, ...style };
  const cls = `colored-name ${fx !== "none" ? `colored-name--${fx}` : ""} ${className}`.trim();

  if (as === "button") {
    return (
      <button
        type={type ?? "button"}
        className={cls}
        style={merged}
        title={title}
        onClick={onClick}
        data-fx={fx}
      >
        {name}
      </button>
    );
  }
  if (as === "p") {
    return (
      <p className={cls} style={merged} title={title} data-fx={fx}>
        {name}
      </p>
    );
  }
  return (
    <span className={cls} style={merged} title={title} data-fx={fx}>
      {name}
    </span>
  );
}
