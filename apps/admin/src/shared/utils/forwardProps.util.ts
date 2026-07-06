export const shouldNotForwardPropsWithKeys =
  <T>(props: ReadonlyArray<keyof T>) =>
  (propName: PropertyKey): boolean => {
    return !props
      .map((p) => p.toString())
      .includes(propName.toString());
  };
