"use client";

import { useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { useCallback, useRef } from "react";
import {
  type GetTargetScrollTop,
  useStickToBottomContext,
} from "use-stick-to-bottom";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { cn } from "@/lib/utils";

export interface GameConversationProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  isReconnecting?: boolean;
  isStreaming?: boolean;
  liveAnnouncement?: string;
}

const compactFeedMediaQuery = "(max-width: 767px)";
const initialAnchorBreathingRoomPx = 8;
const contentGrowthTolerancePx = 1;

type InitialFeedAnchor =
  | { mode: "pending" }
  | {
      contentHeight: number;
      mode: "assistant-start";
      scrollTop: number;
    }
  | { mode: "latest" };

interface GameConversationScrollButtonProps {
  instant: boolean;
  onRequestLatest: () => void;
}

function GameConversationScrollButton({
  instant,
  onRequestLatest,
}: GameConversationScrollButtonProps) {
  const { scrollToBottom } = useStickToBottomContext();
  const handleScrollToLatest = useCallback(() => {
    onRequestLatest();
    scrollToBottom(instant ? "instant" : "smooth");
  }, [instant, onRequestLatest, scrollToBottom]);

  return <ConversationScrollButton onClick={handleScrollToLatest} />;
}

export function GameConversation({
  children,
  className,
  contentClassName,
  isReconnecting = false,
  isStreaming = false,
  liveAnnouncement = "",
}: GameConversationProps) {
  const shouldReduceMotion = useReducedMotion();
  const shouldUseInstantScroll = shouldReduceMotion === true || isReconnecting;
  const resizeAnimation = shouldUseInstantScroll ? "instant" : "smooth";
  const initialFeedAnchor = useRef<InitialFeedAnchor>({ mode: "pending" });
  const releaseInitialAnchor = useCallback(() => {
    initialFeedAnchor.current = { mode: "latest" };
  }, []);
  const resolveScrollTarget = useCallback<GetTargetScrollTop>(
    (latestScrollTop, { contentElement, scrollElement }) => {
      const assistantMessages = contentElement.querySelectorAll<HTMLElement>(
        '[data-role="assistant"]',
      );
      const latestAssistant = assistantMessages.item(
        assistantMessages.length - 1,
      );
      const view = scrollElement.ownerDocument.defaultView;

      if (
        isReconnecting ||
        latestAssistant?.getAttribute("aria-busy") === "true" ||
        !view?.matchMedia(compactFeedMediaQuery).matches
      ) {
        initialFeedAnchor.current = { mode: "latest" };
        return latestScrollTop;
      }

      const currentAnchor = initialFeedAnchor.current;

      if (currentAnchor.mode === "latest") {
        return latestScrollTop;
      }

      if (currentAnchor.mode === "assistant-start") {
        const receivedNewContent =
          contentElement.scrollHeight >
          currentAnchor.contentHeight + contentGrowthTolerancePx;

        if (receivedNewContent) {
          initialFeedAnchor.current = { mode: "latest" };
          return latestScrollTop;
        }

        return Math.min(currentAnchor.scrollTop, latestScrollTop);
      }

      if (!latestAssistant || scrollElement.clientHeight === 0) {
        return latestScrollTop;
      }

      const assistantRect = latestAssistant.getBoundingClientRect();
      const scrollRect = scrollElement.getBoundingClientRect();

      if (assistantRect.height <= scrollElement.clientHeight) {
        initialFeedAnchor.current = { mode: "latest" };
        return latestScrollTop;
      }

      const assistantScrollTop = Math.max(
        0,
        scrollElement.scrollTop +
          assistantRect.top -
          scrollRect.top -
          initialAnchorBreathingRoomPx,
      );

      initialFeedAnchor.current = {
        contentHeight: contentElement.scrollHeight,
        mode: "assistant-start",
        scrollTop: assistantScrollTop,
      };

      return Math.min(assistantScrollTop, latestScrollTop);
    },
    [isReconnecting],
  );

  return (
    <>
      <Conversation
        aria-busy={isReconnecting}
        aria-label="Cronologia dell'avventura"
        aria-live={isStreaming ? "off" : "polite"}
        aria-relevant="additions"
        className={cn("min-h-0 bg-game-surface", className)}
        data-connection-state={isReconnecting ? "reconnecting" : "connected"}
        data-stream-state={isStreaming ? "streaming" : "settled"}
        initial="instant"
        resize={resizeAnimation}
        targetScrollTop={resolveScrollTarget}
      >
        <ConversationContent className={contentClassName}>
          {children}
        </ConversationContent>
        <GameConversationScrollButton
          instant={shouldUseInstantScroll}
          onRequestLatest={releaseInitialAnchor}
        />
      </Conversation>
      <p
        aria-atomic="true"
        aria-live="polite"
        className="sr-only"
        data-testid="narrative-live-announcer"
      >
        {liveAnnouncement}
      </p>
    </>
  );
}
