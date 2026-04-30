/**
 * Globaler "nur ein Mikro gleichzeitig"-Lock.
 * VoiceInput-Komponenten registrieren ihren stop()-Callback, und beim Start
 * fordert eine Komponente den Lock an: alle anderen werden gestoppt und
 * disabled, bis die aktive Aufnahme + Transkription beendet sind.
 */
type Listener = (activeId: number | null) => void;

let activeId: number | null = null;
let nextId = 1;
const stoppers = new Map<number, () => void>();
const listeners = new Set<Listener>();

export const voiceLock = {
  nextId(): number {
    return nextId++;
  },
  isLocked(): boolean {
    return activeId !== null;
  },
  activeId(): number | null {
    return activeId;
  },
  /** Register a stop function for an instance, so the lock owner can request remote stop. */
  registerStopper(id: number, stop: () => void) {
    stoppers.set(id, stop);
    return () => stoppers.delete(id);
  },
  /** Try to acquire the lock for `id`. Returns true if granted. */
  acquire(id: number): boolean {
    if (activeId !== null && activeId !== id) {
      // Another mic is already active – deny.
      return false;
    }
    activeId = id;
    listeners.forEach((l) => l(activeId));
    return true;
  },
  /** Release the lock if `id` is the current owner. */
  release(id: number) {
    if (activeId === id) {
      activeId = null;
      listeners.forEach((l) => l(activeId));
    }
  },
  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
