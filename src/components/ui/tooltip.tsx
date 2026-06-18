import * as React from 'react';
import { createPortal } from 'react-dom';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

export const tooltipSurfaceClass =
  'w-fit max-w-xs rounded border border-[#1a3a1a] bg-[#0a100a] px-2.5 py-1.5 font-mono text-xs leading-snug text-[#39ff14] shadow-[0_0_12px_rgba(57,255,20,0.25)]';

function TooltipProvider({
  delayDuration = 200,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 6,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn('z-50', tooltipSurfaceClass, className)}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="fill-[#0a100a]" width={10} height={5} />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

interface CursorTooltipProps {
  open: boolean;
  x: number;
  y: number;
  children: React.ReactNode;
  offset?: { x: number; y: number };
}

/** Tooltip that tracks pointer position (shadcn surface styling). */
function CursorTooltip({
  open,
  x,
  y,
  children,
  offset = { x: 14, y: 14 },
}: CursorTooltipProps) {
  if (!open) return null;

  return createPortal(
    <div
      role="tooltip"
      className={cn('pointer-events-none fixed z-50', tooltipSurfaceClass)}
      style={{
        left: x + offset.x,
        top: y + offset.y,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, CursorTooltip };
