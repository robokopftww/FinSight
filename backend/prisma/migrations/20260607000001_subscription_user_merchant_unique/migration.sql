-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_merchantName_key" ON "Subscription"("userId", "merchantName");
