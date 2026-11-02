-- CreateEnum
CREATE TYPE "MatchMode" AS ENUM ('RANKED', 'FRIENDLY');

-- DropIndex
DROP INDEX "Question_difficulty_idx";

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "endReason" TEXT,
ADD COLUMN     "endsAt" TIMESTAMP(3),
ADD COLUMN     "mode" "MatchMode" NOT NULL DEFAULT 'RANKED';

-- AlterTable
ALTER TABLE "MatchPlayer" ADD COLUMN     "ratingAfter" INTEGER,
ADD COLUMN     "ratingBefore" INTEGER,
ADD COLUMN     "replay" JSONB;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "constraints" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "signature" JSONB;

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "message" TEXT,
ADD COLUMN     "qualityScore" DOUBLE PRECISION,
ADD COLUMN     "results" JSONB,
ALTER COLUMN "runtimeMs" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "TestCase" ADD COLUMN     "explanation" TEXT,
ADD COLUMN     "label" TEXT,
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PracticeAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL,
    "passedTests" INTEGER NOT NULL,
    "totalTests" INTEGER NOT NULL,
    "runtimeMs" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PracticeAttempt_userId_questionId_idx" ON "PracticeAttempt"("userId", "questionId");

-- CreateIndex
CREATE INDEX "Question_difficulty_isActive_idx" ON "Question"("difficulty", "isActive");

-- AddForeignKey
ALTER TABLE "PracticeAttempt" ADD CONSTRAINT "PracticeAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeAttempt" ADD CONSTRAINT "PracticeAttempt_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
