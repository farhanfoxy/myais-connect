import { Module } from '@nestjs/common';
import { loadEnvironment, type ApiEnvironment } from '../config/environment.js';
import { PRIVATE_STORAGE } from './private-storage.js';
import type { PrivateStorage } from './private-storage.js';
import { SupabasePrivateStorage } from './supabase-private-storage.js';
import { UnavailablePrivateStorage } from './unavailable-private-storage.js';

export function selectPrivateStorage(environment: ApiEnvironment): PrivateStorage {
  if (!environment.supabasePrivateStorage) return new UnavailablePrivateStorage();
  return new SupabasePrivateStorage({
    supabaseUrl: environment.supabaseUrl,
    ...environment.supabasePrivateStorage,
  });
}

@Module({
  providers: [
    { provide: PRIVATE_STORAGE, useFactory: () => selectPrivateStorage(loadEnvironment()) },
  ],
  exports: [PRIVATE_STORAGE],
})
export class StorageModule {}
