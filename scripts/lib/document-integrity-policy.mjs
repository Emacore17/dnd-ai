import path from "node:path";

import {
  markdownHeadingCatalog,
  markdownLinkTargets,
  referenceTarget,
  visibleMarkdownLines,
} from "./markdown-document.mjs";

const METADATA_REFERENCE_FIELDS = ["source_refs", "code_refs", "test_refs"];
const SECTION_REFERENCE_START_PATTERN =
  /(?<!`)`([^`\r\n]+\.md)`(?!`)[ \t]+§{1,2}[ \t]*/gu;
const SECTION_TOKEN_PATTERN = /[0-9.]+/gu;

function isNumericSectionToken(token) {
  const segments = token.split(".");
  return (
    segments.length > 0 &&
    segments.every(
      (segment) =>
        segment.length > 0 &&
        [...segment].every((character) => character >= "0" && character <= "9"),
    )
  );
}

function maskDoubleBacktickSpans(line) {
  let masked = "";
  let cursor = 0;
  let insideSpan = false;

  while (cursor < line.length) {
    if (line.startsWith("``", cursor)) {
      insideSpan = !insideSpan;
      masked += "  ";
      cursor += 2;
      continue;
    }

    masked += insideSpan ? " " : line[cursor];
    cursor += 1;
  }

  return masked;
}

function normalizeDocumentPath(documentPath) {
  return path.posix.normalize(documentPath.replaceAll("\\", "/"));
}

function isOutsideRepository(documentPath) {
  return (
    documentPath === ".." ||
    documentPath.startsWith("../") ||
    path.posix.isAbsolute(documentPath)
  );
}

function isExternalLink(target) {
  return /^[a-z][a-z0-9+.-]*:/iu.test(target) || target.startsWith("//");
}

function decodeReference(reference) {
  const fragmentIndex = reference.indexOf("#");
  const target =
    fragmentIndex === -1 ? reference : reference.slice(0, fragmentIndex);
  const fragment =
    fragmentIndex === -1 ? null : reference.slice(fragmentIndex + 1);

  try {
    return {
      fragment: fragment === null ? null : decodeURIComponent(fragment),
      target: decodeURIComponent(target),
    };
  } catch {
    return null;
  }
}

function relativeDocumentPath(sourcePath, target) {
  const resolved = normalizeDocumentPath(
    path.posix.join(path.posix.dirname(sourcePath), target),
  );
  return isOutsideRepository(resolved) ? null : resolved;
}

function validateRelativeFragments({ catalogs, errors, sources }) {
  for (const [sourcePath, source] of sources) {
    for (const reference of markdownLinkTargets(source)) {
      if (isExternalLink(reference) || !reference.includes("#")) {
        continue;
      }

      const decoded = decodeReference(reference);
      if (!decoded || !decoded.fragment) {
        errors.push(`${sourcePath}: invalid-relative-fragment ${reference}`);
        continue;
      }

      const targetPath = decoded.target
        ? relativeDocumentPath(sourcePath, decoded.target)
        : sourcePath;
      if (!targetPath) {
        errors.push(`${sourcePath}: invalid-relative-fragment ${reference}`);
        continue;
      }

      const targetCatalog = catalogs.get(targetPath);
      if (targetCatalog && !targetCatalog.anchors.has(decoded.fragment)) {
        errors.push(`${sourcePath}: broken-relative-fragment ${reference}`);
      }
    }
  }
}

function validateMetadataFragments({ catalogs, errors, metadataByPath }) {
  for (const [sourcePath, metadata] of metadataByPath) {
    if (!metadata || typeof metadata !== "object") {
      continue;
    }

    for (const field of METADATA_REFERENCE_FIELDS) {
      const references = metadata[field];
      if (!Array.isArray(references)) {
        continue;
      }

      for (const reference of references) {
        const parsed = referenceTarget(reference);
        if (!parsed || parsed.planned || !parsed.fragment) {
          continue;
        }

        let targetPath;
        let fragment;
        try {
          targetPath = normalizeDocumentPath(decodeURIComponent(parsed.target));
          fragment = decodeURIComponent(parsed.fragment);
        } catch {
          errors.push(`${sourcePath}: invalid-metadata-fragment ${reference}`);
          continue;
        }

        const targetCatalog = catalogs.get(targetPath);
        if (targetCatalog && !targetCatalog.anchors.has(fragment)) {
          errors.push(`${sourcePath}: broken-metadata-fragment ${reference}`);
        }
      }
    }
  }
}

function sectionDocumentPath(sourcePath, referencedPath) {
  const normalizedReference = referencedPath.replaceAll("\\", "/");
  const resolved = normalizeDocumentPath(
    normalizedReference.startsWith("./") ||
      normalizedReference.startsWith("../")
      ? path.posix.join(path.posix.dirname(sourcePath), normalizedReference)
      : normalizedReference,
  );
  return isOutsideRepository(resolved) ? null : resolved;
}

function validateSectionReferences({ catalogs, errors, sources }) {
  for (const [sourcePath, source] of sources) {
    const visibleSource = visibleMarkdownLines(source)
      .map(({ line }) => maskDoubleBacktickSpans(line))
      .join("\n");

    for (const match of visibleSource.matchAll(
      SECTION_REFERENCE_START_PATTERN,
    )) {
      const referencedPath = match[1];
      const targetPath = sectionDocumentPath(sourcePath, referencedPath);
      if (!targetPath) {
        errors.push(
          `${sourcePath}: invalid-section-reference-path ${referencedPath}`,
        );
        continue;
      }

      const targetCatalog = catalogs.get(targetPath);
      if (!targetCatalog) {
        errors.push(`${sourcePath}: missing-section-document ${targetPath}`);
        continue;
      }

      const referenceTail = visibleSource
        .slice(match.index + match[0].length)
        .match(/^[0-9.,e \t–-]+/u)?.[0];
      for (const tokenMatch of (referenceTail ?? "").matchAll(
        SECTION_TOKEN_PATTERN,
      )) {
        const section = tokenMatch[0];
        if (!isNumericSectionToken(section)) {
          continue;
        }
        if (!targetCatalog.sections.has(section)) {
          errors.push(
            `${sourcePath}: missing-section-reference ${targetPath} §${section}`,
          );
        }
      }
    }
  }
}

export async function validateDocumentIntegrity({
  sources,
  metadataByPath,
  validateMermaid = async () => [],
}) {
  const errors = [];
  const catalogs = new Map(
    [...sources].map(([documentPath, source]) => [
      documentPath,
      markdownHeadingCatalog(source),
    ]),
  );

  validateRelativeFragments({ catalogs, errors, sources });
  validateMetadataFragments({ catalogs, errors, metadataByPath });
  validateSectionReferences({ catalogs, errors, sources });
  errors.push(...(await validateMermaid(sources)));

  return { errors: errors.sort() };
}
