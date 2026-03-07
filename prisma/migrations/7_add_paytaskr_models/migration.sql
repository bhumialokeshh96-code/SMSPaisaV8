-- PayTaskr: Payment Task Earning Platform schema additions
-- Adds new enums, updates existing models, adds new models

-- New Enums
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'ASSIGNED', 'CLAIMED', 'IN_PROGRESS', 'PROOF_UPLOADED', 'VERIFIED', 'COMPLETED', 'FAILED', 'EXPIRED');
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED');
CREATE TYPE "UpiStatus" AS ENUM ('ACTIVE', 'DISABLED', 'FAILED');
CREATE TYPE "RiskLevel" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH');

-- Add new TransactionType values
ALTER TYPE "TransactionType" ADD VALUE 'COMMISSION';
ALTER TYPE "TransactionType" ADD VALUE 'NEWBIE_REWARD';

-- Add new TransactionStatus value
ALTER TYPE "TransactionStatus" ADD VALUE 'PROCESSING';

-- Add relatedTaskId to Transaction
ALTER TABLE "Transaction" ADD COLUMN "relatedTaskId" TEXT;

-- Update User model: add new fields
ALTER TABLE "User"
  ADD COLUMN "pin"                 TEXT,
  ADD COLUMN "isSellActive"        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sellActivatedAt"     TIMESTAMP(3),
  ADD COLUMN "paymentAppInstalled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "totalCollection"     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN "totalPayout"         DECIMAL(12,2) NOT NULL DEFAULT 0.00;

-- Update Wallet model: add reward, pending, createdAt
ALTER TABLE "Wallet"
  ADD COLUMN "reward"    DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN "pending"   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Update Referral model: add level, commissionRate
ALTER TABLE "Referral"
  ADD COLUMN "level"          TEXT NOT NULL DEFAULT 'B',
  ADD COLUMN "commissionRate" DECIMAL(5,2) NOT NULL DEFAULT 0.00;

-- Update PlatformSettings: add new fields
ALTER TABLE "PlatformSettings"
  ADD COLUMN "defaultCommissionRate"  DECIMAL(5,2) NOT NULL DEFAULT 4.5,
  ADD COLUMN "minWithdrawalAmount"    DECIMAL(10,2) NOT NULL DEFAULT 50.00,
  ADD COLUMN "maxWithdrawalPerDay"    DECIMAL(10,2) NOT NULL DEFAULT 10000.00,
  ADD COLUMN "newbieRewardAmount"     DECIMAL(10,2) NOT NULL DEFAULT 350.00,
  ADD COLUMN "newbieRewardThreshold"  DECIMAL(12,2) NOT NULL DEFAULT 2000.00,
  ADD COLUMN "signupBonus"            DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN "referrerBonus"          DECIMAL(10,2) NOT NULL DEFAULT 10.00,
  ADD COLUMN "referredBonus"          DECIMAL(10,2) NOT NULL DEFAULT 5.00,
  ADD COLUMN "cashbackDisplayRate"    DECIMAL(5,2) NOT NULL DEFAULT 4.5,
  ADD COLUMN "paymentWarningMessage"  TEXT NOT NULL DEFAULT 'Please use Freecharge or Mobikwik or amazon wallet for payment!';

-- PaymentTask table
CREATE TABLE "PaymentTask" (
  "id"               TEXT NOT NULL,
  "code"             CHAR(6) NOT NULL,
  "title"            TEXT,
  "amount"           DECIMAL(12,2) NOT NULL,
  "commissionRate"   DECIMAL(5,2) NOT NULL DEFAULT 4.5,
  "commissionAmount" DECIMAL(12,2) NOT NULL,
  "recipientName"    TEXT,
  "recipientUPI"     TEXT NOT NULL,
  "paymentMethod"    TEXT NOT NULL DEFAULT 'UPI',
  "instructions"     TEXT,
  "status"           "TaskStatus" NOT NULL DEFAULT 'PENDING',
  "assignedToId"     TEXT,
  "claimedAt"        TIMESTAMP(3),
  "completedAt"      TIMESTAMP(3),
  "expiresAt"        TIMESTAMP(3),
  "priority"         INTEGER NOT NULL DEFAULT 0,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentTask_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentTask_code_key" UNIQUE ("code"),
  CONSTRAINT "PaymentTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- TaskProof table
CREATE TABLE "TaskProof" (
  "id"            TEXT NOT NULL,
  "taskId"        TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "screenshotUrl" TEXT,
  "transactionId" TEXT,
  "notes"         TEXT,
  "isVerified"    BOOLEAN NOT NULL DEFAULT false,
  "verifiedAt"    TIMESTAMP(3),
  "verifiedBy"    TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskProof_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaskProof_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "PaymentTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TaskProof_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- UserUpiAccount table
CREATE TABLE "UserUpiAccount" (
  "id"             TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "upiType"        TEXT NOT NULL DEFAULT 'UPI',
  "upiId"          TEXT NOT NULL,
  "status"         "UpiStatus" NOT NULL DEFAULT 'ACTIVE',
  "riskLevel"      "RiskLevel" NOT NULL DEFAULT 'NONE',
  "limitMin"       DECIMAL(12,2) NOT NULL DEFAULT 10.00,
  "limitMax"       DECIMAL(12,2) NOT NULL DEFAULT 100000.00,
  "paymentAppName" TEXT,
  "isDefault"      BOOLEAN NOT NULL DEFAULT false,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserUpiAccount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserUpiAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- NewbieReward table
CREATE TABLE "NewbieReward" (
  "id"                        TEXT NOT NULL,
  "userId"                    TEXT NOT NULL,
  "amount"                    DECIMAL(10,2) NOT NULL DEFAULT 350.00,
  "totalTransactionsRequired" DECIMAL(12,2) NOT NULL DEFAULT 2000.00,
  "currentTransactionTotal"   DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  "isClaimed"                 BOOLEAN NOT NULL DEFAULT false,
  "claimedAt"                 TIMESTAMP(3),
  "createdAt"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NewbieReward_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NewbieReward_userId_key" UNIQUE ("userId"),
  CONSTRAINT "NewbieReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Withdrawal table
CREATE TABLE "Withdrawal" (
  "id"               TEXT NOT NULL,
  "userId"           TEXT NOT NULL,
  "amount"           DECIMAL(10,2) NOT NULL,
  "status"           "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
  "paymentMethod"    TEXT NOT NULL,
  "paymentDetails"   JSONB NOT NULL,
  "pinVerified"      BOOLEAN NOT NULL DEFAULT false,
  "razorpayPayoutId" TEXT,
  "processedAt"      TIMESTAMP(3),
  "rejectionReason"  TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Withdrawal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Notification table
CREATE TABLE "Notification" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "title"     TEXT NOT NULL,
  "message"   TEXT NOT NULL,
  "isRead"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Indexes
CREATE INDEX "PaymentTask_status_idx" ON "PaymentTask"("status");
CREATE INDEX "PaymentTask_assignedToId_idx" ON "PaymentTask"("assignedToId");
CREATE INDEX "TaskProof_taskId_idx" ON "TaskProof"("taskId");
CREATE INDEX "TaskProof_userId_idx" ON "TaskProof"("userId");
CREATE INDEX "UserUpiAccount_userId_idx" ON "UserUpiAccount"("userId");
CREATE INDEX "Withdrawal_userId_idx" ON "Withdrawal"("userId");
CREATE INDEX "Withdrawal_status_idx" ON "Withdrawal"("status");
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");
