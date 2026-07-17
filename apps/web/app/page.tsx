import { InteractiveGameShell } from "@/components/game/interactive-game-shell";
import { createInitialGameShellState } from "@/lib/game-shell/game-shell-fixtures";

export default function HomePage() {
  return (
    <InteractiveGameShell initialViewModel={createInitialGameShellState()} />
  );
}
