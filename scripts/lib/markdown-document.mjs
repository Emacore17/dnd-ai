import GithubSlugger from "github-slugger";
import { parse } from "yaml";

const PLANNED_SUFFIX = " (planned)";

function numericSectionPrefix(heading) {
  const firstWhitespace = heading.search(/\s/u);
  const firstToken = (
    firstWhitespace === -1 ? heading : heading.slice(0, firstWhitespace)
  ).replace(/\.$/u, "");
  const segments = firstToken.split(".");

  return segments.length > 0 &&
    segments.every(
      (segment) =>
        segment.length > 0 &&
        [...segment].every((character) => character >= "0" && character <= "9"),
    )
    ? firstToken
    : null;
}

export function parseFrontMatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u);
  if (!match) {
    return null;
  }

  try {
    const metadata = parse(match[1]);
    return metadata && typeof metadata === "object" ? metadata : null;
  } catch {
    return null;
  }
}

export function referenceTarget(reference) {
  if (typeof reference !== "string") {
    return null;
  }

  const planned = reference.endsWith(PLANNED_SUFFIX);
  const value = planned
    ? reference.slice(0, -PLANNED_SUFFIX.length)
    : reference;
  const fragmentIndex = value.indexOf("#");
  const target = (
    fragmentIndex === -1 ? value : value.slice(0, fragmentIndex)
  ).trim();
  const fragment =
    fragmentIndex === -1 ? null : value.slice(fragmentIndex + 1).trim() || null;

  return target ? { fragment, planned, target } : null;
}

export function visibleMarkdownLines(source) {
  const lines = [];
  let openFence = null;

  source.split(/\r?\n/u).forEach((line, index) => {
    const trimmedLine = line.trimStart();
    const fence = trimmedLine.match(/^(`{3,}|~{3,})/u)?.[1] ?? null;

    if (openFence) {
      if (
        fence &&
        fence[0] === openFence[0] &&
        fence.length >= openFence.length
      ) {
        openFence = null;
      }
      return;
    }

    if (fence) {
      openFence = fence;
      return;
    }

    lines.push({ line, lineNumber: index + 1 });
  });

  return lines;
}

export function markdownLinkTargets(source) {
  const targets = [];
  const linkPattern = /\]\(([^)\r\n]+)\)/gu;
  const visibleSource = visibleMarkdownLines(source)
    .map(({ line }) => line)
    .join("\n");

  for (const match of visibleSource.matchAll(linkPattern)) {
    const contents = match[1].trim();
    if (contents.startsWith("<")) {
      const closingBracket = contents.indexOf(">");
      targets.push(
        closingBracket === -1 ? contents : contents.slice(1, closingBracket),
      );
      continue;
    }
    targets.push(contents.split(/\s/u, 1)[0]);
  }

  return targets;
}

export function markdownHeadingCatalog(source) {
  const slugger = new GithubSlugger();
  const anchors = new Set();
  const sections = new Set();

  for (const { line } of visibleMarkdownLines(source)) {
    const match = line.match(/^#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/u);
    if (!match) {
      continue;
    }

    anchors.add(slugger.slug(match[1]));
    const section = numericSectionPrefix(match[1]);
    if (section) {
      sections.add(section);
    }
  }

  return { anchors, sections };
}

function fenceRun(line) {
  const trimmed = line.trimStart();
  const marker = trimmed[0];
  if (marker !== "`" && marker !== "~") {
    return null;
  }

  let length = 0;
  while (trimmed[length] === marker) {
    length += 1;
  }

  return length >= 3
    ? { info: trimmed.slice(length).trim(), length, marker }
    : null;
}

export function extractMermaidBlocks(source, documentPath) {
  const blocks = [];
  let current = null;

  for (const line of source.split(/\r?\n/u)) {
    const fence = fenceRun(line);
    if (!current) {
      if (fence?.info.toLowerCase() === "mermaid") {
        current = {
          blockIndex: blocks.length + 1,
          documentPath,
          fenceLength: fence.length,
          marker: fence.marker,
          lines: [],
        };
      }
      continue;
    }

    if (
      fence &&
      fence.marker === current.marker &&
      fence.length >= current.fenceLength &&
      !fence.info
    ) {
      blocks.push({
        blockIndex: current.blockIndex,
        closed: true,
        documentPath,
        source: current.lines.join("\n"),
      });
      current = null;
      continue;
    }

    current.lines.push(line);
  }

  if (current) {
    blocks.push({
      blockIndex: current.blockIndex,
      closed: false,
      documentPath,
      source: current.lines.join("\n"),
    });
  }

  return blocks;
}
