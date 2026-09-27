-- AlterTable
ALTER TABLE "ApplicationDocument" ADD COLUMN "storageObjectKey" TEXT;

-- AlterTable
ALTER TABLE "InformationRequest" ADD COLUMN "responseAttachmentObjectKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationDocument_storageObjectKey_key" ON "ApplicationDocument"("storageObjectKey");

-- CreateIndex
CREATE UNIQUE INDEX "InformationRequest_responseAttachmentObjectKey_key" ON "InformationRequest"("responseAttachmentObjectKey");
