ALTER TABLE "User"
ADD COLUMN "employmentStatus" TEXT NOT NULL DEFAULT 'unknown',
ADD COLUMN "jobTitle" TEXT,
ADD COLUMN "grossPay" DECIMAL(12,2),
ADD COLUMN "payFrequency" TEXT,
ADD COLUMN "onboardedAt" TIMESTAMP(3);
