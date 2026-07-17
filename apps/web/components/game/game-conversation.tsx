import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { NarrativeTurn } from "@/components/game/narrative-turn";
import type { NarrativeTurnView } from "@/lib/game-shell/game-shell-model";

export interface GameConversationProps {
  readonly turns: readonly NarrativeTurnView[];
  readonly isAnimating?: boolean;
}

export function GameConversation({
  turns,
  isAnimating = false,
}: GameConversationProps) {
  return (
    <Conversation
      aria-label="Cronologia dell'avventura"
      className="min-h-0 overscroll-contain"
    >
      <ConversationContent className="mx-auto w-full max-w-3xl pb-8 sm:px-6">
        {turns.map((turn, index) => (
          <NarrativeTurn
            isAnimating={isAnimating && index === turns.length - 1}
            key={turn.id}
            turn={turn}
          />
        ))}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}
