"use client";

import { XIcon } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

const drawerSnapPoints = [1];

export interface GameDrawerProps {
  children: ReactNode;
  contentClassName?: string;
  description?: string;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  title: string;
  trigger: ReactElement;
}

/**
 * Domain wrapper for secondary game information.
 *
 * Vaul owns the dialog semantics, focus trap, Escape handling and focus return;
 * this wrapper keeps those behaviours consistent across every mobile HUD panel.
 */
export function GameDrawer({
  children,
  contentClassName,
  description,
  onOpenChange,
  open,
  title,
  trigger,
}: GameDrawerProps) {
  const drawerProps = {
    ...(open === undefined ? {} : { open }),
    ...(onOpenChange === undefined ? {} : { onOpenChange }),
  };

  return (
    <Drawer
      autoFocus
      fadeFromIndex={0}
      snapPoints={drawerSnapPoints}
      {...drawerProps}
    >
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent
        className={cn(
          "mx-auto max-h-[min(82dvh,46rem)] w-full max-w-2xl overflow-hidden rounded-t-3xl border-game-border bg-game-surface-elevated pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]",
          contentClassName,
        )}
      >
        <DrawerHeader className="relative border-b border-game-border px-5 pt-5 pr-16 pb-4 text-left">
          <DrawerTitle className="text-base leading-6">{title}</DrawerTitle>
          <DrawerDescription
            className={cn(
              "max-w-prose pr-2 text-sm leading-5",
              !description && "sr-only",
            )}
          >
            {description ?? `Dettagli del pannello ${title}.`}
          </DrawerDescription>
          <DrawerClose asChild>
            <Button
              aria-label={`Chiudi ${title}`}
              className="absolute top-3.5 right-3.5 size-11 rounded-xl"
              size="icon"
              type="button"
              variant="ghost"
            >
              <XIcon aria-hidden="true" className="size-5" />
            </Button>
          </DrawerClose>
        </DrawerHeader>
        <div
          aria-label={`Contenuto ${title}`}
          className="min-h-0 overflow-y-auto overscroll-contain px-5 py-5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          role="region"
          tabIndex={0}
        >
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
