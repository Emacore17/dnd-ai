import {
  Message,
  MessageContent,
  MessageResponse,
  type MessageRole,
} from "@/components/ai-elements/message";
import { cn } from "@/lib/utils";

export interface NarrativeTurnProps {
  className?: string;
  content: string;
  isStreaming?: boolean;
  role: MessageRole;
  speaker?: string;
}

export function NarrativeTurn({
  className,
  content,
  isStreaming = false,
  role,
  speaker = role === "assistant" ? "Dungeon Master" : "Tu",
}: NarrativeTurnProps) {
  const isAssistant = role === "assistant";

  return (
    <Message
      aria-busy={isStreaming}
      aria-label={`Messaggio di ${speaker}`}
      aria-live={isAssistant && isStreaming ? "off" : undefined}
      className={cn(isAssistant && "max-w-full", className)}
      from={role}
      role="article"
    >
      <span
        className={cn(
          "text-xs font-semibold tracking-[0.12em] uppercase",
          isAssistant ? "text-primary" : "text-muted-foreground",
        )}
      >
        {speaker}
      </span>
      <MessageContent>
        {isAssistant ? (
          <MessageResponse isAnimating={isStreaming}>{content}</MessageResponse>
        ) : (
          <p className="m-0 whitespace-pre-wrap break-words">{content}</p>
        )}
      </MessageContent>
    </Message>
  );
}
