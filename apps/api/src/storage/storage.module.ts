import { Module } from '@nestjs/common';
import { PRIVATE_STORAGE } from './private-storage.js';
import { UnavailablePrivateStorage } from './unavailable-private-storage.js';

@Module({
  providers: [
    UnavailablePrivateStorage,
    { provide: PRIVATE_STORAGE, useExisting: UnavailablePrivateStorage },
  ],
  exports: [PRIVATE_STORAGE],
})
export class StorageModule {}
