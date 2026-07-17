"use client";

import { CornerDownLeftIcon } from "lucide-react";
import {
  useCallback,
  useState,
  type ComponentProps,
  type KeyboardEventHandler,
} from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type PromptInputProps = ComponentProps<"form">;

export const PromptInput = ({ className, ...props }: PromptInputProps) => (
  <form
    className={cn(
      "flex w-full items-end gap-2 rounded-2xl border border-input bg-card p-2 shadow-lg",
      className,
    )}
    {...props}
  />
);

export type PromptInputTextareaProps = Omit<
  ComponentProps<typeof Textarea>,
  "onCompositionEnd" | "onCompositionStart"
>;

export const PromptInputTextarea = ({
  className,
  onKeyDown,
  placeholder = "Cosa vuoi fare?",
  ...props
}: PromptInputTextareaProps) => {
  const [isComposing, setIsComposing] = useState(false);
  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = useCallback(
    (event) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) {
        return;
      }

      if (
        event.key !== "Enter" ||
        event.shiftKey ||
        isComposing ||
        event.nativeEvent.isComposing
      ) {
        return;
      }

      event.preventDefault();
      const submitButton = event.currentTarget.form?.querySelector(
        'button[type="submit"]',
      );
      if (submitButton instanceof HTMLButtonElement && !submitButton.disabled) {
        event.currentTarget.form?.requestSubmit(submitButton);
      }
    },
    [isComposing, onKeyDown],
  );

  return (
    <Textarea
      className={cn(
        "max-h-36 min-h-12 resize-none border-0 bg-transparent px-3 py-3 shadow-none focus-visible:ring-0",
        className,
      )}
      name="message"
      onCompositionEnd={() => setIsComposing(false)}
      onCompositionStart={() => setIsComposing(true)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      {...props}
    />
  );
};

export type PromptInputSubmitProps = Omit<
  ComponentProps<typeof Button>,
  "type"
>;

export const PromptInputSubmit = ({
  "aria-label": ariaLabel = "Invia azione",
  children,
  className,
  size = "icon-lg",
  ...props
}: PromptInputSubmitProps) => (
  <Button
    aria-label={ariaLabel}
    className={cn("shrink-0 rounded-xl", className)}
    size={size}
    {...props}
    type="submit"
  >
    {children ?? <CornerDownLeftIcon aria-hidden="true" className="size-5" />}
  </Button>
);
