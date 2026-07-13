const blockBoundary = /\r?\n\s*\r?\n/u;
const trailingBlockBoundary = /\r?\n\s*\r?\n\s*$/u;

function stripNarrativeMarkdown(value: string): string {
  return value
    .replace(/^\s*[-+]\s+/gmu, "")
    .replace(/[*_~`>#]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

export function getNarrativeLiveAnnouncement(
  content: string,
  isStreaming: boolean,
): string {
  const blocks = content
    .split(blockBoundary)
    .map(stripNarrativeMarkdown)
    .filter((block) => block.length > 0);

  if (isStreaming && !trailingBlockBoundary.test(content)) {
    blocks.pop();
  }

  const latestCompleteBlock = blocks.at(-1);

  return latestCompleteBlock ? `Dungeon Master: ${latestCompleteBlock}` : "";
}
