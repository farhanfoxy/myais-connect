const storageKey = 'myais.pending-registration-name.v1';
const lifetimeMs = 24 * 60 * 60 * 1000;

export interface PendingRegistrationName {
  fullName: string;
  email: string;
  createdAt: number;
}

export interface PendingRegistrationNameStore {
  save(input: { fullName: string; email: string }): void;
  read(): PendingRegistrationName | null;
  clear(): void;
}

export function createPendingRegistrationNameStore(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  now: () => number = Date.now,
): PendingRegistrationNameStore {
  const remove = () => {
    try { storage.removeItem(storageKey); } catch { /* Browser storage can be unavailable. */ }
  };
  return {
    save(input) {
      try { storage.setItem(storageKey, JSON.stringify({ ...input, createdAt: now() })); } catch {
        // Registration remains valid when browser storage is unavailable.
      }
    },
    read() {
      try {
        const raw = storage.getItem(storageKey);
        if (!raw) return null;
        const value = JSON.parse(raw) as Partial<PendingRegistrationName>;
        if (typeof value.fullName !== 'string' || typeof value.email !== 'string' ||
            typeof value.createdAt !== 'number' || now() - value.createdAt > lifetimeMs ||
            value.createdAt > now() || value.fullName.length < 2) {
          remove();
          return null;
        }
        return { fullName: value.fullName, email: value.email, createdAt: value.createdAt };
      } catch {
        remove();
        return null;
      }
    },
    clear() {
      remove();
    },
  };
}
