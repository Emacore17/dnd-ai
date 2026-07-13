import { GameShell } from "@/components/game/game-shell";
import { getGameShellFixture } from "@/lib/game-shell-state";

interface HomePageProps {
  searchParams: Promise<{
    state?: string | string[];
  }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const parameters = await searchParams;
  const requestedState = Array.isArray(parameters.state)
    ? parameters.state[0]
    : parameters.state;

  return <GameShell fixture={getGameShellFixture(requestedState)} />;
}
