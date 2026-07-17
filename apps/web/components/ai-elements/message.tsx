"use client";

import { memo, type ComponentProps, type HTMLAttributes } from "react";
import { Streamdown } from "streamdown";

import { cn } from "@/lib/utils";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: "user" | "assistant";
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full max-w-[95%] flex-col gap-2",
      from === "user" ? "is-user ml-auto items-end" : "is-assistant",
      className,
    )}
    {...props}
  />
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = ({
  children,
  className,
  ...props
}: MessageContentProps) => (
  <div
    className={cn(
      "flex w-fit min-w-0 max-w-full flex-col gap-2 overflow-hidden text-sm leading-relaxed",
      "group-[.is-user]:ml-auto group-[.is-user]:rounded-2xl group-[.is-user]:bg-secondary group-[.is-user]:px-4 group-[.is-user]:py-3 group-[.is-user]:text-foreground",
      "group-[.is-assistant]:text-foreground",
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

const safeNarrativeComponents = {
  a: ({ children }: ComponentProps<"a">) => (
    <span className="font-medium text-foreground">{children}</span>
  ),
  img: () => null,
};

export interface MessageResponseProps {
  readonly children: string;
  readonly className?: string;
  readonly isAnimating?: boolean;
}

export const MessageResponse = memo(
  ({ children, className, isAnimating = false }: MessageResponseProps) => (
    <Streamdown
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className,
      )}
      components={safeNarrativeComponents}
      isAnimating={isAnimating}
      skipHtml
      urlTransform={() => null}
    >
      {children}
    </Streamdown>
  ),
  (previous, next) =>
    previous.children === next.children &&
    previous.className === next.className &&
    previous.isAnimating === next.isAnimating,
);

MessageResponse.displayName = "MessageResponse";
