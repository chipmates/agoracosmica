export type GatePass = {
  key: string;
  id: number;
  isCurrent: () => boolean;
};

export function createRequestGate() {
  const lastResolved = new Map<string, number>();

  return {
    begin(key: string): GatePass {
      const currentId = (lastResolved.get(key) ?? 0) + 1;
      lastResolved.set(key, currentId);

      return {
        key,
        id: currentId,
        isCurrent: () => lastResolved.get(key) === currentId,
      };
    },
  };
}
