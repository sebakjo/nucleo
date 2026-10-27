DROP INDEX "clase_por_plantilla";--> statement-breakpoint
ALTER TABLE "clases" ADD COLUMN "generada_para" timestamp with time zone;--> statement-breakpoint
-- Las clases que ya existían se generaron en su horario actual.
UPDATE "clases" SET "generada_para" = "inicia_en" WHERE "plantilla_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "clase_por_plantilla" ON "clases" USING btree ("plantilla_id","generada_para");
