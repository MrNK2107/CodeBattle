-- Matches now allow one (final) submission per player; keep only the latest of any earlier duplicates.
DELETE FROM "Submission" s
USING "Submission" newer
WHERE s."matchId" = newer."matchId" AND s."userId" = newer."userId"
  AND (s."submittedAt" < newer."submittedAt" OR (s."submittedAt" = newer."submittedAt" AND s."id" < newer."id"));

-- DropIndex
DROP INDEX "Submission_matchId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Submission_matchId_userId_key" ON "Submission"("matchId", "userId");

