-- CreateIndex
CREATE INDEX "Swipe_liked_createdAt_movieId_idx" ON "Swipe"("liked", "createdAt", "movieId");
