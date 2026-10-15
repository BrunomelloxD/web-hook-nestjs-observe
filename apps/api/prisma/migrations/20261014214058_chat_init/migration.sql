-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('USER', 'JOINED', 'LEFT');

-- CreateTable
CREATE TABLE "participants" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "name_key" VARCHAR(20) NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "seq" BIGSERIAL NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'USER',
    "content" VARCHAR(1000) NOT NULL DEFAULT '',
    "client_id" TEXT,
    "participant_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "participants_token_hash_key" ON "participants"("token_hash");

-- CreateIndex
CREATE INDEX "participants_left_at_idx" ON "participants"("left_at");

-- CreateIndex
CREATE UNIQUE INDEX "participants_online_name_key" ON "participants"("name_key") WHERE ("left_at" IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "messages_seq_key" ON "messages"("seq");

-- CreateIndex
CREATE INDEX "messages_participant_id_idx" ON "messages"("participant_id");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

