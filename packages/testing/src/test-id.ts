export type TestId = string & { readonly __brand: "TestId" };

function isUppercaseLetter(character: string): boolean {
  return character >= "A" && character <= "Z";
}

function isDigit(character: string): boolean {
  return character >= "0" && character <= "9";
}

function hasOnlyTaskCharacters(segment: string): boolean {
  return (
    segment.length > 0 &&
    [...segment].every(
      (character) => isUppercaseLetter(character) || isDigit(character),
    )
  );
}

function isTaskId(value: string): boolean {
  const segments = value.split("-");
  const firstSegment = segments[0];

  return (
    segments.length >= 2 &&
    firstSegment !== undefined &&
    isUppercaseLetter(firstSegment[0] ?? "") &&
    segments.every(hasOnlyTaskCharacters)
  );
}

function isCaseSlug(value: string): boolean {
  const segments = value.split("-");

  return segments.every(
    (segment) =>
      segment.length > 0 &&
      [...segment].every(
        (character) =>
          (character >= "a" && character <= "z") || isDigit(character),
      ),
  );
}

export function createTestId(taskId: string, caseSlug: string): TestId {
  if (!isTaskId(taskId) || !isCaseSlug(caseSlug)) {
    throw new Error("testing: invalid-test-id");
  }

  return `${taskId}:${caseSlug}` as TestId;
}
