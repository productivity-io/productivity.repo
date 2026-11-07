/** Confirm observed UI state; invocation alone is not success. */
export async function confirmPortalAction(
  matches: () => boolean,
  success: string,
  signal: AbortSignal,
  timeoutMs = 2000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (!signal.aborted) {
    if (matches()) return success;
    if (Date.now() >= deadline) return 'I could not confirm that the portal view changed. Please check the page and try again.';
    await new Promise<void>(resolve => setTimeout(resolve, 25));
  }
  return 'The portal action was cancelled.';
}
