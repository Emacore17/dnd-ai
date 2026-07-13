"use client";

import { ArrowUpIcon, LoaderCircleIcon } from "lucide-react";
import type { ComponentProps, HTMLAttributes } from "react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

export type PromptInputProps = ComponentProps<"form">;

export function PromptInput({
  children,
  className,
  ...props
}: PromptInputProps) {
  return (
    <form className={cn("w-full", className)} {...props}>
      <InputGroup className="overflow-hidden rounded-2xl border-border/80 bg-card shadow-[0_14px_48px_-24px_oklch(0_0_0_/_0.8)]">
        {children}
      </InputGroup>
    </form>
  );
}

export type PromptInputBodyProps = HTMLAttributes<HTMLDivElement>;

export function PromptInputBody({ className, ...props }: PromptInputBodyProps) {
  return <div className={cn("w-full", className)} {...props} />;
}

export type PromptInputTextareaProps = ComponentProps<
  typeof InputGroupTextarea
>;

export function PromptInputTextarea({
  className,
  ...props
}: PromptInputTextareaProps) {
  return (
    <InputGroupTextarea
      className={cn(
        "min-h-14 max-h-36 px-4 pt-4 pb-2 text-base leading-6 placeholder:text-muted-foreground/80",
        className,
      )}
      {...props}
    />
  );
}

export type PromptInputFooterProps = ComponentProps<typeof InputGroupAddon>;

export function PromptInputFooter({
  className,
  ...props
}: PromptInputFooterProps) {
  return (
    <InputGroupAddon
      align="block-end"
      className={cn("min-h-12 justify-between gap-3 px-3 pb-3", className)}
      {...props}
    />
  );
}

export type PromptInputToolsProps = HTMLAttributes<HTMLDivElement>;

export function PromptInputTools({
  className,
  ...props
}: PromptInputToolsProps) {
  return (
    <div
      className={cn("flex min-w-0 items-center gap-2", className)}
      {...props}
    />
  );
}

export type PromptInputSubmitProps = Omit<
  ComponentProps<typeof InputGroupButton>,
  "size"
> & {
  pending?: boolean;
  label?: string;
};

export function PromptInputSubmit({
  children,
  className,
  label = "Invia azione",
  pending = false,
  ...props
}: PromptInputSubmitProps) {
  return (
    <InputGroupButton
      aria-label={pending ? "Azione in elaborazione" : label}
      className={cn(
        "size-12 shrink-0 rounded-xl bg-primary text-primary-foreground shadow-[0_10px_28px_-14px_var(--primary)] hover:bg-primary/90",
        className,
      )}
      disabled={pending || props.disabled}
      size="icon-sm"
      type="submit"
      variant="default"
      {...props}
    >
      {children ??
        (pending ? (
          <LoaderCircleIcon
            aria-hidden="true"
            className="size-5 animate-spin"
          />
        ) : (
          <ArrowUpIcon aria-hidden="true" className="size-5" />
        ))}
    </InputGroupButton>
  );
}
