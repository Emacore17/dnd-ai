"use client";

import type { FormEvent, KeyboardEvent } from "react";
import { useId } from "react";

import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { cn } from "@/lib/utils";

export interface FreeActionComposerProps {
  className?: string;
  disabled?: boolean;
  label?: string;
  maxLength?: number;
  onSubmit: (value: string) => void;
  onValueChange: (value: string) => void;
  pending?: boolean;
  placeholder?: string;
  value: string;
}

const defaultMaxLength = 2_000;

export function FreeActionComposer({
  className,
  disabled = false,
  label = "Scrivi la tua azione",
  maxLength = defaultMaxLength,
  onSubmit,
  onValueChange,
  pending = false,
  placeholder = "Descrivi cosa vuoi fare…",
  value,
}: FreeActionComposerProps) {
  const counterId = useId();
  const inputId = useId();
  const safeMaxLength = Math.min(defaultMaxLength, Math.max(1, maxLength));
  const isLocked = disabled || pending;
  const isOverLimit = value.length > safeMaxLength;
  const isSubmitDisabled = isLocked || isOverLimit || value.trim().length === 0;

  function submitValue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedValue = value.trim();
    if (isLocked || isOverLimit || normalizedValue.length === 0) {
      return;
    }

    onSubmit(normalizedValue);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <div
      className={cn(
        "sticky bottom-0 z-30 border-t border-game-border bg-background px-3 pt-3 pb-[var(--composer-safe-area)] sm:px-4",
        className,
      )}
    >
      <PromptInput
        aria-busy={pending}
        className="game-prompt-input"
        onSubmit={submitValue}
      >
        <PromptInputBody className="game-prompt-body">
          <label className="sr-only" htmlFor={inputId}>
            {label}
          </label>
          <PromptInputTextarea
            aria-describedby={counterId}
            aria-invalid={isOverLimit}
            disabled={isLocked}
            className="game-prompt-textarea"
            id={inputId}
            maxLength={safeMaxLength}
            name="free-action"
            onChange={(event) => onValueChange(event.currentTarget.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            value={value}
          />
        </PromptInputBody>
        <PromptInputFooter className="game-prompt-footer">
          <PromptInputTools className="game-prompt-hint">
            <span className="text-xs text-muted-foreground">
              Invio: Enter · Nuova riga: Maiusc+Enter
            </span>
          </PromptInputTools>
          <div className="flex shrink-0 items-center gap-2">
            <output
              aria-label={`${value.length} di ${safeMaxLength} caratteri`}
              className={cn(
                "game-prompt-counter min-w-14 text-right text-xs tabular-nums text-muted-foreground",
                isOverLimit && "text-destructive",
              )}
              id={counterId}
            >
              {value.length}/{safeMaxLength}
            </output>
            <PromptInputSubmit
              disabled={isSubmitDisabled}
              label="Invia azione"
              pending={pending}
            />
          </div>
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
