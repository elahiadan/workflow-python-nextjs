import * as React from "react"

const MOBILE_BREAKPOINT = 768

function subscribe(onStoreChange: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", onStoreChange)
  return () => mql.removeEventListener("change", onStoreChange)
}

function getSnapshot() {
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches
}

/** Matches the sidebar's `md` breakpoint, without an extra render pass. */
export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, () => false)
}

/**
 * `false` during SSR and the first client render, then `true`. Use for
 * markup that must not be produced until the client takes over.
 */
export function useMounted() {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
}
