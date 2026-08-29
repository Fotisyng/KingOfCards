import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

import { cn } from "@/lib/utils";

/** Wraps trigger/content in a shared provider so nearby tooltips share one open delay. */
function TooltipProvider({ delay = 300, ...props }: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider delay={delay} {...props} />;
}

/** Groups a `TooltipTrigger` and `TooltipContent` pair; must be wrapped in a `TooltipProvider`. */
function Tooltip(props: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root {...props} />;
}

/** The element that opens the tooltip on hover or focus. */
function TooltipTrigger(props: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger {...props} />;
}

/** The tooltip's floating content, portaled and positioned against its trigger. */
function TooltipContent({
  className,
  sideOffset = 8,
  side = "top",
  ...props
}: TooltipPrimitive.Popup.Props & TooltipPrimitive.Positioner.Props) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner sideOffset={sideOffset} side={side}>
        <TooltipPrimitive.Popup
          className={cn(
            "z-50 rounded-md bg-popover px-2.5 py-1.5 text-popover-foreground text-xs shadow-md",
            "data-[open]:animate-in data-[open]:fade-in-0 data-[open]:zoom-in-95",
            "data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95",
            className,
          )}
          {...props}
        />
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
