"use client";

import { BackpackIcon, TargetIcon, UsersIcon, XIcon } from "lucide-react";
import { useRef, type MouseEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type {
  GameDrawerSection,
  GameHudView,
} from "@/lib/game-shell/game-shell-model";

export interface GameDrawerProps {
  readonly activeSection: GameDrawerSection | null;
  readonly hud: GameHudView;
  readonly onClose: () => void;
  readonly onOpenSection: (section: GameDrawerSection) => void;
}

const sectionCopy = {
  objective: {
    title: "Obiettivo",
    description: "Il prossimo traguardo della scena.",
  },
  party: {
    title: "Party",
    description: "I compagni presenti nella scena.",
  },
  inventory: {
    title: "Inventario",
    description: "Gli oggetti disponibili in questo momento.",
  },
} as const satisfies Record<
  GameDrawerSection,
  Readonly<{ title: string; description: string }>
>;

function getSectionCopy(section: GameDrawerSection) {
  switch (section) {
    case "objective":
      return sectionCopy.objective;
    case "party":
      return sectionCopy.party;
    case "inventory":
      return sectionCopy.inventory;
  }
}

export function GameDrawer({
  activeSection,
  hud,
  onClose,
  onOpenSection,
}: GameDrawerProps) {
  const lastTrigger = useRef<HTMLButtonElement | null>(null);
  const copy = activeSection ? getSectionCopy(activeSection) : null;

  const openSection = (
    section: GameDrawerSection,
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    lastTrigger.current = event.currentTarget;
    onOpenSection(section);
  };

  return (
    <>
      <nav aria-label="HUD dell'avventura" className="grid grid-cols-3 gap-1">
        <Button
          aria-haspopup="dialog"
          aria-label="Apri obiettivo"
          onClick={(event) => openSection("objective", event)}
          type="button"
          variant="ghost"
        >
          <TargetIcon aria-hidden="true" className="size-4" />
          <span className="text-xs">Obiettivo</span>
        </Button>
        <Button
          aria-haspopup="dialog"
          aria-label="Apri party"
          onClick={(event) => openSection("party", event)}
          type="button"
          variant="ghost"
        >
          <UsersIcon aria-hidden="true" className="size-4" />
          <span className="text-xs">Party</span>
        </Button>
        <Button
          aria-haspopup="dialog"
          aria-label="Apri inventario"
          onClick={(event) => openSection("inventory", event)}
          type="button"
          variant="ghost"
        >
          <BackpackIcon aria-hidden="true" className="size-4" />
          <span className="text-xs">Inventario</span>
        </Button>
      </nav>

      <Drawer
        direction="bottom"
        onOpenChange={(open) => {
          if (!open) {
            onClose();
          }
        }}
        open={activeSection !== null}
      >
        <DrawerContent
          className="mx-auto max-h-[72svh] w-full max-w-3xl"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            lastTrigger.current?.focus();
          }}
        >
          <DrawerHeader className="relative shrink-0 border-b border-border/80 pr-16 text-left">
            <DrawerTitle>{copy?.title ?? "Dettagli"}</DrawerTitle>
            <DrawerDescription>
              {copy?.description ?? "Informazioni della scena."}
            </DrawerDescription>
            <DrawerClose asChild>
              <Button
                aria-label="Chiudi dettagli"
                className="absolute top-2 right-3"
                size="icon"
                type="button"
                variant="ghost"
              >
                <XIcon aria-hidden="true" className="size-4" />
              </Button>
            </DrawerClose>
          </DrawerHeader>
          <div className="min-h-0 overflow-y-auto px-4 pt-4 pb-[var(--safe-area-bottom)] sm:px-6">
            {activeSection === "objective" ? (
              <p className="max-w-[65ch] text-sm leading-relaxed">
                {hud.objective}
              </p>
            ) : null}
            {activeSection === "party" ? (
              <ul className="space-y-2">
                {hud.party.map((member) => (
                  <li
                    className="rounded-xl bg-muted px-3 py-3 text-sm"
                    key={member}
                  >
                    {member}
                  </li>
                ))}
              </ul>
            ) : null}
            {activeSection === "inventory" ? (
              <ul className="space-y-2">
                {hud.inventory.map((item) => (
                  <li
                    className="rounded-xl bg-muted px-3 py-3 text-sm"
                    key={item}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
