-- Nullable external Supabase auth.users identity. Existing and historical users remain unlinked.
ALTER TABLE "User" ADD COLUMN "supabaseAuthUserId" UUID;

CREATE UNIQUE INDEX "User_supabaseAuthUserId_key" ON "User"("supabaseAuthUserId");
