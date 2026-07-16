declare const structuredClone: <T>(value: T) => T;

export interface FixtureFactoryOptions<T extends object> {
  base: () => T;
  parse: (candidate: unknown) => T;
}

export type FixtureFactory<T extends object> = (
  overrides?: Readonly<Partial<T>>,
) => T;

export function createFixtureFactory<T extends object>({
  base,
  parse,
}: FixtureFactoryOptions<T>): FixtureFactory<T> {
  return (overrides): T => {
    const candidate = Object.assign(
      structuredClone(base()),
      overrides === undefined ? {} : structuredClone(overrides),
    );
    const parsed = parse(structuredClone(candidate));

    return structuredClone(parsed);
  };
}
