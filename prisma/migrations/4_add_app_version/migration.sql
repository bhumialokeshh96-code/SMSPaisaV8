CREATE TABLE "AppVersion" (
    "id" TEXT NOT NULL DEFAULT 'current',
    "latestVersion" TEXT NOT NULL,
    "minVersion" TEXT NOT NULL,
    "apkUrl" TEXT NOT NULL,
    "releaseNotes" TEXT NOT NULL DEFAULT '',
    "forceUpdate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppVersion_pkey" PRIMARY KEY ("id")
);
