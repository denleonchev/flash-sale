-- CreateIndex
CREATE INDEX "orders_sale_id_status_idx" ON "orders"("sale_id", "status");
