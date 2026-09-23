export interface Rect {
  left: number
  top: number
  right: number
  bottom: number
}

export interface Point {
  x: number
  y: number
}

export const width = (r: Rect) => r.right - r.left
export const height = (r: Rect) => r.bottom - r.top
export const center = (r: Rect): Point => ({ x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 })

export const contains = (r: Rect, p: Point) => p.x >= r.left && p.x < r.right && p.y >= r.top && p.y < r.bottom

export const overlaps = (a: Rect, b: Rect) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

export const inflate = (r: Rect, by: number): Rect => ({
  left: r.left - by,
  top: r.top - by,
  right: r.right + by,
  bottom: r.bottom + by,
})

export const union = (a: Rect, b: Rect): Rect => ({
  left: Math.min(a.left, b.left),
  top: Math.min(a.top, b.top),
  right: Math.max(a.right, b.right),
  bottom: Math.max(a.bottom, b.bottom),
})

/**
 * The centered region the user aims at a price tag. Price tags are wide, so the box is
 * about twice as wide as it is tall, capped so it fits between the top bar and buttons.
 */
export function aimBoxRect(viewWidth: number, viewHeight: number): Rect {
  const w = viewWidth * 0.85
  const h = Math.min(w * 0.55, viewHeight * 0.4)
  return {
    left: (viewWidth - w) / 2,
    top: (viewHeight - h) / 2,
    right: (viewWidth + w) / 2,
    bottom: (viewHeight + h) / 2,
  }
}

/**
 * Puts the label centered above [anchor], or below it when there's no room above, and
 * shifts it sideways so it stays [margin] px inside the container.
 */
export function labelPosition(
  anchor: Rect,
  label: { width: number; height: number },
  container: { width: number; height: number },
  margin: number,
  gap: number,
): Point {
  const maxX = Math.max(container.width - label.width - margin, margin)
  const x = Math.min(Math.max(Math.round(center(anchor).x - label.width / 2), margin), maxX)

  const above = Math.round(anchor.top - gap - label.height)
  const below = Math.round(anchor.bottom + gap)
  const y = above >= margin ? above : Math.min(below, Math.max(container.height - label.height - margin, 0))
  return { x, y }
}
