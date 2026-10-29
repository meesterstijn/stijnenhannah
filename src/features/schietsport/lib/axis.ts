const STEPS = [1, 2, 5, 10, 20, 25, 50];

// Nette as: ronde stappen (1, 2, 5, 10, …), nooit boven het maximum van de
// schaal, met wat lucht onder de laagste waarde.
export function niceScale(
  values: number[],
  scale: number,
): { domain: [number, number]; ticks: number[] } {
  if (values.length === 0) {
    return { domain: [0, scale], ticks: [0, scale / 2, scale] };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, scale >= 100 ? 10 : 2);
  const step = STEPS.find((s) => span / s <= 5) ?? 50;
  const lo = Math.max(0, Math.floor((min - step / 2) / step) * step);
  const hi = Math.min(scale, Math.ceil((max + step / 4) / step) * step);
  const ticks: number[] = [];
  for (let t = lo; t <= hi + 1e-9; t += step) ticks.push(t);
  if (ticks[ticks.length - 1] !== hi) ticks.push(hi);
  return { domain: [lo, hi], ticks };
}
