-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "receiptObjectKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_receiptObjectKey_key" ON "Payment"("receiptObjectKey");
