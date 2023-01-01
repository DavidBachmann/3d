export const linearScale = (
  value: number,
  yRange: [number, number],
  xRange: [number, number]
): number => {
  const [xMin, xMax] = xRange;
  const [yMin, yMax] = yRange;

  const percent = (value - yMin) / (yMax - yMin);
  return percent * (xMax - xMin) + xMin;
};
