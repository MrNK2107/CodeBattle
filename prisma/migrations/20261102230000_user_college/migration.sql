-- Players can represent a college or club; the college leaderboard groups by the slug.
ALTER TABLE "User" ADD COLUMN "college" TEXT;
ALTER TABLE "User" ADD COLUMN "collegeSlug" TEXT;

-- CreateIndex
CREATE INDEX "User_collegeSlug_rating_idx" ON "User"("collegeSlug", "rating");
