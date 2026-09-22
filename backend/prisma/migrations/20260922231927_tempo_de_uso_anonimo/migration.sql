-- CreateTable
CREATE TABLE "SessaoDeUso" (
    "id" TEXT NOT NULL,
    "pseudonimo" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoSinal" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "segundos" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SessaoDeUso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SessaoDeUso_pseudonimo_idx" ON "SessaoDeUso"("pseudonimo");
