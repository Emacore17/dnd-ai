"use client";

import type { ComponentProps, HTMLAttributes } from "react";
import { memo } from "react";
import { Streamdown, type Components } from "streamdown";

import { cn } from "@/lib/utils";

export type MessageRole = "assistant" | "user";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: MessageRole;
};

export function Message({ className, from, ...props }: MessageProps) {
  return (
    <div
      className={cn(
        "group flex w-full min-w-0 max-w-[96%] flex-col gap-2",
        from === "user" ? "is-user ml-auto items-end" : "is-assistant",
        className,
      )}
      data-role={from}
      {...props}
    />
  );
}

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export function MessageContent({
  children,
  className,
  ...props
}: MessageContentProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 max-w-full flex-col gap-2 text-[0.9375rem] leading-7",
        "group-[.is-user]:w-fit group-[.is-user]:max-w-[88%] group-[.is-user]:rounded-2xl group-[.is-user]:rounded-br-md group-[.is-user]:bg-secondary group-[.is-user]:px-4 group-[.is-user]:py-3",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

const allowedNarrativeElements = [
  "p",
  "em",
  "strong",
  "ul",
  "ol",
  "li",
] as const;

const narrativeMarkdownComponents: Components = {
  em: ({ node, ...props }) => {
    void node;
    return <em {...props} />;
  },
  strong: ({ node, ...props }) => {
    void node;
    return <strong {...props} />;
  },
};

export type MessageResponseProps = Omit<
  ComponentProps<typeof Streamdown>,
  "allowedElements" | "components" | "skipHtml" | "unwrapDisallowed"
>;

export const MessageResponse = memo(
  ({ className, ...props }: MessageResponseProps) => (
    <Streamdown
      className={cn(
        "size-full text-pretty [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_li]:my-1 [&_p]:my-3",
        className,
      )}
      {...props}
      allowedElements={allowedNarrativeElements}
      components={narrativeMarkdownComponents}
      skipHtml
      unwrapDisallowed
    />
  ),
  (previousProps, nextProps) =>
    previousProps.children === nextProps.children &&
    previousProps.isAnimating === nextProps.isAnimating,
);

MessageResponse.displayName = "MessageResponse";
