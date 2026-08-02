const CENTER = 200;
const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5] as const;

const point = (radius: number, angle: number) => {
  const radians = ((angle - 90) * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(radians), y: CENTER + radius * Math.sin(radians) };
};

export function ringPath(inner: number, outer: number, index: number): string {
  const start = index * 18 - 9;
  const end = start + 18;
  const a = point(outer, start); const b = point(outer, end); const c = point(inner, end); const d = point(inner, start);
  return `M ${a.x} ${a.y} A ${outer} ${outer} 0 0 1 ${b.x} ${b.y} L ${c.x} ${c.y} A ${inner} ${inner} 0 0 0 ${d.x} ${d.y} Z`;
}

export const segments = ORDER.map((value, index) => ({ value, index }));
export const labelPoint = (index: number) => point(178, index * 18);
