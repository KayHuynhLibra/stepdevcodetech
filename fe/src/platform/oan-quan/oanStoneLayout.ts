/** Vị trí % trong ô cho từng viên đá (xếp xoắn ốc, thu nhỏ khi nhiều). */
export type StoneSlot = {
  x: number;
  y: number;
  scale: number;
  rot: number;
};

export function stoneSlots(count: number): StoneSlot[] {
  if (count <= 0) return [];
  const scale =
    count <= 5 ? 1 : count <= 9 ? 0.86 : count <= 14 ? 0.72 : count <= 20 ? 0.6 : 0.5;
  const spread = count <= 5 ? 0.34 : count <= 9 ? 0.38 : count <= 14 ? 0.42 : 0.46;

  if (count === 1) {
    return [{ x: 50, y: 50, scale, rot: -8 }];
  }

  return Array.from({ length: count }, (_, i) => {
    const angle = i * 2.399963;
    const r = spread * 100 * Math.sqrt((i + 1) / count);
    const rot = ((i * 47) % 40) - 20;
    return {
      x: 50 + Math.cos(angle) * r,
      y: 50 + Math.sin(angle) * r,
      scale,
      rot,
    };
  });
}
