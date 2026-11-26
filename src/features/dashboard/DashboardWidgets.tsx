import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { CalendarDays, X } from 'lucide-react';

export type DashboardWidget = {
  id: string;
  type: 'clock' | 'calendar';
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

export const readWidgets = (): DashboardWidget[] => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem('keeper-widgets') || '[]');
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (widget) =>
          widget && typeof widget.id === 'string' && ['clock', 'calendar'].includes(widget.type)
      )
      .map((widget, index) => ({
        ...widget,
        x: Number.isFinite(widget.x) ? widget.x : (index % 2) * 250,
        y: Number.isFinite(widget.y) ? widget.y : Math.floor(index / 2) * 245,
        width: Number.isFinite(widget.width)
          ? widget.width
          : widget.type === 'calendar'
            ? 228
            : 180,
        height: Number.isFinite(widget.height)
          ? widget.height
          : widget.type === 'calendar'
            ? 230
            : 130,
      })) as DashboardWidget[];
  } catch {
    return [];
  }
};

function ClockWidget() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="widget-clock-content">
      <strong>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
      <span>
        {now.toLocaleDateString([], {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })}
      </span>
    </div>
  );
}

function CalendarWidget() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
  const days = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return (
    <>
      <header>
        <CalendarDays size={16} />
        <strong>{today.toLocaleDateString([], { month: 'long', year: 'numeric' })}</strong>
      </header>
      <div className="widget-calendar-grid">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
          <span className="widget-weekday" key={`${day}${index}`}>
            {day}
          </span>
        ))}
        {Array.from({ length: firstDay }, (_, index) => (
          <span key={`blank${index}`} />
        ))}
        {Array.from({ length: days }, (_, index) => (
          <span className={index + 1 === today.getDate() ? 'today' : ''} key={index + 1}>
            {index + 1}
          </span>
        ))}
      </div>
    </>
  );
}

function WidgetCard({
  widget,
  onRemove,
  onResize,
}: {
  widget: DashboardWidget;
  onRemove: (id: string) => void;
  onResize: (id: string, size: { width: number; height: number }) => void;
}) {
  const width = widget.width ?? (widget.type === 'calendar' ? 228 : 180);
  const height = widget.height ?? (widget.type === 'calendar' ? 230 : 130);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } =
    useDraggable({
      id: `dashboard-widget:${widget.id}`,
      data: { type: 'widget', widgetId: widget.id },
    });
  const resizeStart = useRef<{
    pointerId: number;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const resizeSize = useRef({ width, height });
  const [size, setSize] = useState({ width, height });
  useEffect(() => {
    const next = { width, height };
    setSize(next);
    resizeSize.current = next;
  }, [width, height]);
  const startResize = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    resizeStart.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      width: size.width,
      height: size.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveResize = (event: PointerEvent<HTMLButtonElement>) => {
    const start = resizeStart.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const area = document.querySelector('.dashboard-widgets')?.getBoundingClientRect();
    const minWidth = widget.type === 'calendar' ? 190 : 160;
    const minHeight = widget.type === 'calendar' ? 200 : 110;
    const next = {
      width: Math.max(
        minWidth,
        Math.min(
          window.innerWidth - (area?.left ?? 0) - (widget.x ?? 0),
          start.width + event.clientX - start.x
        )
      ),
      height: Math.max(
        minHeight,
        Math.min(
          window.innerHeight - 90 - (area?.top ?? 0) - (widget.y ?? 0),
          start.height + event.clientY - start.y
        )
      ),
    };
    resizeSize.current = next;
    setSize(next);
  };
  const endResize = (event: PointerEvent<HTMLButtonElement>) => {
    if (resizeStart.current?.pointerId !== event.pointerId) return;
    resizeStart.current = null;
    onResize(widget.id, resizeSize.current);
  };

  return (
    <article
      ref={setNodeRef}
      className={`dashboard-widget widget-${widget.type} ${isDragging ? 'is-dragging' : ''}`}
      style={{
        left: widget.x ?? 0,
        top: widget.y ?? 0,
        width: size.width,
        height: size.height,
        transform: CSS.Translate.toString(transform),
      }}
    >
      <button
        ref={setActivatorNodeRef}
        className="widget-drag-handle"
        type="button"
        aria-label={`Drag ${widget.type} widget`}
        {...attributes}
        {...listeners}
      />
      <button
        className="widget-remove"
        aria-label={`Remove ${widget.type} widget`}
        title="Remove widget"
        onClick={() => onRemove(widget.id)}
      >
        <X size={13} />
      </button>
      <div className="widget-content">
        {widget.type === 'clock' ? <ClockWidget /> : <CalendarWidget />}
      </div>
      <button
        className="widget-resize-handle"
        type="button"
        aria-label={`Resize ${widget.type} widget`}
        onPointerDown={startResize}
        onPointerMove={moveResize}
        onPointerUp={endResize}
        onPointerCancel={endResize}
      />
    </article>
  );
}

export function DashboardWidgets({
  widgets,
  onRemove,
  onResize,
}: {
  widgets: DashboardWidget[];
  onRemove: (id: string) => void;
  onResize: (id: string, size: { width: number; height: number }) => void;
}) {
  return (
    <div className="dashboard-widgets">
      {widgets.map((widget) => (
        <WidgetCard key={widget.id} widget={widget} onRemove={onRemove} onResize={onResize} />
      ))}
    </div>
  );
}
