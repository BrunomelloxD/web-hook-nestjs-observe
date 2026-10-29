-- CreateIndex
CREATE UNIQUE INDEX "messages_participant_client_key" ON "messages"("participant_id", "client_id");
