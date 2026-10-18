/** Makes async UI updates last-request-wins without coupling the policy to React. */
export function createLatestRequestGate() {
  let latest = 0;
  return {
    begin() { latest += 1; return latest; },
    isCurrent(requestId: number) { return requestId === latest; },
  };
}
