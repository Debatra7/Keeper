export type AlignmentGuide = { axis: 'x' | 'y'; position: number };

export function snapToAlignment(rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>, targets: DOMRect[], viewport: { width: number; height: number }, threshold = 8) {
  const movingX = [rect.left, rect.left + rect.width / 2, rect.left + rect.width];
  const movingY = [rect.top, rect.top + rect.height / 2, rect.top + rect.height];
  const targetX = [0, viewport.width / 2, viewport.width, ...targets.flatMap(target => [target.left, target.left + target.width / 2, target.left + target.width])];
  const targetY = [76, viewport.height / 2, viewport.height - 90, ...targets.flatMap(target => [target.top, target.top + target.height / 2, target.top + target.height])];
  const closest = (moving: number[], target: number[]) => {
    let result: { offset: number; position: number } | undefined;
    for (const from of moving) for (const to of target) if (Math.abs(to - from) <= threshold && (!result || Math.abs(to - from) < Math.abs(result.offset))) result = { offset: to - from, position: to };
    return result;
  };
  const x = closest(movingX, targetX);
  const y = closest(movingY, targetY);
  return { x: x?.offset ?? 0, y: y?.offset ?? 0, guides: [...(x ? [{ axis: 'x' as const, position: x.position }] : []), ...(y ? [{ axis: 'y' as const, position: y.position }] : [])] };
}

export function getAlignmentTargets() {
  return [...document.querySelectorAll<HTMLElement>('.search-wrap, .dashboard-widget')]
    .filter(element => !element.classList.contains('is-dragging'))
    .map(element => element.getBoundingClientRect());
}
