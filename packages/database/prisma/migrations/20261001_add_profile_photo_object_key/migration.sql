ALTER TABLE "User" ADD COLUMN "profilePhotoObjectKey" TEXT;

CREATE UNIQUE INDEX "User_profilePhotoObjectKey_key" ON "User"("profilePhotoObjectKey");
