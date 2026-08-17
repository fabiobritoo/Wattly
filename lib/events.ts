// Lightweight cross-component signal: any form that mutates readings/notes
// broadcasts this after a successful save, and pages that display that data
// listen for it to refresh — without needing prop drilling or a context
// provider. Useful mainly for the global "+" FAB, which can be used from
// any page, not just the one that owns the data it's editing.
export const DATA_CHANGED_EVENT = "wattly:data-changed";

export function broadcastDataChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
  }
}
