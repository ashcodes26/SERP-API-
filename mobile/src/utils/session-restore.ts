/** A stale or expired bearer token is recoverable: clear it and show sign-in. */
export function sessionRestoreAction(status: number | undefined): 'clear_session' | 'show_error' {
  return status === 401 ? 'clear_session' : 'show_error';
}
