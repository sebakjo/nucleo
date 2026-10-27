CREATE TYPE "public"."estado_clase" AS ENUM('programada', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."estado_email" AS ENUM('pendiente', 'enviado', 'registrado', 'fallido');--> statement-breakpoint
CREATE TYPE "public"."estado_espera" AS ENUM('esperando', 'oferta', 'promovida', 'vencida', 'retirada');--> statement-breakpoint
CREATE TYPE "public"."estado_pack" AS ENUM('pendiente_pago', 'activo', 'vencido', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."estado_pago" AS ENUM('pendiente', 'en_proceso', 'aprobado', 'rechazado', 'cancelado', 'reembolsado');--> statement-breakpoint
CREATE TYPE "public"."estado_reserva" AS ENUM('pendiente_pago', 'confirmada', 'cancelada', 'cancelada_tarde', 'asistio', 'vencida');--> statement-breakpoint
CREATE TYPE "public"."medio_reserva" AS ENUM('credito', 'pago');--> statement-breakpoint
CREATE TYPE "public"."motivo_movimiento" AS ENUM('compra', 'reserva', 'devolucion', 'credito_por_cancelacion', 'clase_cancelada', 'pago_tardio', 'vencimiento', 'ajuste');--> statement-breakpoint
CREATE TYPE "public"."origen_reserva" AS ENUM('directa', 'lista_espera', 'simulacion');--> statement-breakpoint
CREATE TYPE "public"."proveedor_pago" AS ENUM('mercadopago', 'simulado');--> statement-breakpoint
CREATE TYPE "public"."rol" AS ENUM('alumno', 'instructor', 'admin');--> statement-breakpoint
CREATE TYPE "public"."tipo_pago" AS ENUM('clase', 'pack');--> statement-breakpoint
CREATE TABLE "cuentas" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ajustes" (
	"clave" text PRIMARY KEY NOT NULL,
	"valor" jsonb NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plantilla_id" uuid,
	"tipo_clase_id" uuid NOT NULL,
	"instructor_id" uuid NOT NULL,
	"inicia_en" timestamp with time zone NOT NULL,
	"termina_en" timestamp with time zone NOT NULL,
	"cupo" smallint DEFAULT 6 NOT NULL,
	"estado" "estado_clase" DEFAULT 'programada' NOT NULL,
	"sandbox" boolean DEFAULT false NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clase_cupo" CHECK ("clases"."cupo" between 1 and 6)
);
--> statement-breakpoint
CREATE TABLE "emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" text,
	"para" text NOT NULL,
	"plantilla" text NOT NULL,
	"datos" jsonb NOT NULL,
	"asunto" text,
	"estado" "estado_email" DEFAULT 'pendiente' NOT NULL,
	"intentos" smallint DEFAULT 0 NOT NULL,
	"error" text,
	"clave_unica" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"enviado_en" timestamp with time zone,
	CONSTRAINT "emails_claveUnica_unique" UNIQUE("clave_unica")
);
--> statement-breakpoint
CREATE TABLE "eventos_webhook" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proveedor" "proveedor_pago" NOT NULL,
	"clave" text NOT NULL,
	"tipo" text NOT NULL,
	"recurso_id" text,
	"payload" jsonb,
	"recibido_en" timestamp with time zone DEFAULT now() NOT NULL,
	"procesado_en" timestamp with time zone,
	"resultado" text,
	CONSTRAINT "eventos_webhook_clave_unique" UNIQUE("clave")
);
--> statement-breakpoint
CREATE TABLE "instructores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"usuario_id" text,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instructores_usuarioId_unique" UNIQUE("usuario_id")
);
--> statement-breakpoint
CREATE TABLE "limites" (
	"clave" text PRIMARY KEY NOT NULL,
	"ventana_inicio" timestamp with time zone NOT NULL,
	"conteo" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lista_espera" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" text NOT NULL,
	"clase_id" uuid NOT NULL,
	"posicion" integer NOT NULL,
	"estado" "estado_espera" DEFAULT 'esperando' NOT NULL,
	"reserva_id" uuid,
	"oferta_vence" timestamp with time zone,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movimientos_credito" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" text NOT NULL,
	"pack_id" uuid NOT NULL,
	"reserva_id" uuid,
	"delta" smallint NOT NULL,
	"motivo" "motivo_movimiento" NOT NULL,
	"nota" text,
	"actor_id" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "packs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" text NOT NULL,
	"producto_id" uuid,
	"nombre" text NOT NULL,
	"creditos_totales" smallint NOT NULL,
	"creditos_restantes" smallint DEFAULT 0 NOT NULL,
	"estado" "estado_pack" NOT NULL,
	"comprado_en" timestamp with time zone,
	"vence_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pack_restantes" CHECK ("packs"."creditos_restantes" >= 0 and "packs"."creditos_restantes" <= "packs"."creditos_totales")
);
--> statement-breakpoint
CREATE TABLE "pagos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" text NOT NULL,
	"tipo" "tipo_pago" NOT NULL,
	"reserva_id" uuid,
	"pack_id" uuid,
	"proveedor" "proveedor_pago" NOT NULL,
	"preferencia_id" text,
	"url_pago" text,
	"id_externo" text,
	"estado" "estado_pago" DEFAULT 'pendiente' NOT NULL,
	"detalle_estado" text,
	"monto_ars" integer NOT NULL,
	"moneda" text DEFAULT 'ARS' NOT NULL,
	"descripcion" text NOT NULL,
	"datos_proveedor" jsonb,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"aprobado_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pagos_simulados" (
	"id" text PRIMARY KEY NOT NULL,
	"referencia_externa" uuid NOT NULL,
	"estado" text NOT NULL,
	"detalle_estado" text NOT NULL,
	"monto" integer NOT NULL,
	"moneda" text DEFAULT 'ARS' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plantillas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dia_semana" smallint NOT NULL,
	"hora" text NOT NULL,
	"duracion_min" smallint DEFAULT 55 NOT NULL,
	"instructor_id" uuid NOT NULL,
	"tipo_clase_id" uuid NOT NULL,
	"cupo" smallint DEFAULT 6 NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plantilla_dia" CHECK ("plantillas"."dia_semana" between 1 and 7),
	CONSTRAINT "plantilla_hora" CHECK ("plantillas"."hora" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
	CONSTRAINT "plantilla_cupo" CHECK ("plantillas"."cupo" between 1 and 6)
);
--> statement-breakpoint
CREATE TABLE "productos_pack" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"creditos" smallint NOT NULL,
	"precio_ars" integer NOT NULL,
	"validez_dias" smallint DEFAULT 30 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"orden" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "limites_auth" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "limites_auth_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "reservas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" text NOT NULL,
	"clase_id" uuid NOT NULL,
	"estado" "estado_reserva" NOT NULL,
	"medio" "medio_reserva" NOT NULL,
	"origen" "origen_reserva" DEFAULT 'directa' NOT NULL,
	"reformer" smallint NOT NULL,
	"retenida_hasta" timestamp with time zone,
	"pack_id" uuid,
	"precio_ars" integer,
	"recordatorio_enviado_en" timestamp with time zone,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmada_en" timestamp with time zone,
	"cancelada_en" timestamp with time zone,
	CONSTRAINT "reserva_reformer" CHECK ("reservas"."reformer" between 1 and 6)
);
--> statement-breakpoint
CREATE TABLE "sesiones" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "sesiones_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "tipos_clase" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text NOT NULL,
	"nivel" text NOT NULL,
	"duracion_min" smallint DEFAULT 55 NOT NULL,
	CONSTRAINT "tipos_clase_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" text PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"email" text NOT NULL,
	"email_verificado" boolean DEFAULT false NOT NULL,
	"imagen" text,
	"rol" "rol" DEFAULT 'alumno' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verificaciones" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cuentas" ADD CONSTRAINT "cuentas_user_id_usuarios_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clases" ADD CONSTRAINT "clases_plantilla_id_plantillas_id_fk" FOREIGN KEY ("plantilla_id") REFERENCES "public"."plantillas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clases" ADD CONSTRAINT "clases_tipo_clase_id_tipos_clase_id_fk" FOREIGN KEY ("tipo_clase_id") REFERENCES "public"."tipos_clase"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clases" ADD CONSTRAINT "clases_instructor_id_instructores_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instructores" ADD CONSTRAINT "instructores_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lista_espera" ADD CONSTRAINT "lista_espera_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lista_espera" ADD CONSTRAINT "lista_espera_clase_id_clases_id_fk" FOREIGN KEY ("clase_id") REFERENCES "public"."clases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lista_espera" ADD CONSTRAINT "lista_espera_reserva_id_reservas_id_fk" FOREIGN KEY ("reserva_id") REFERENCES "public"."reservas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_credito" ADD CONSTRAINT "movimientos_credito_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_credito" ADD CONSTRAINT "movimientos_credito_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_credito" ADD CONSTRAINT "movimientos_credito_reserva_id_reservas_id_fk" FOREIGN KEY ("reserva_id") REFERENCES "public"."reservas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_credito" ADD CONSTRAINT "movimientos_credito_actor_id_usuarios_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packs" ADD CONSTRAINT "packs_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packs" ADD CONSTRAINT "packs_producto_id_productos_pack_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos_pack"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_reserva_id_reservas_id_fk" FOREIGN KEY ("reserva_id") REFERENCES "public"."reservas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plantillas" ADD CONSTRAINT "plantillas_instructor_id_instructores_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plantillas" ADD CONSTRAINT "plantillas_tipo_clase_id_tipos_clase_id_fk" FOREIGN KEY ("tipo_clase_id") REFERENCES "public"."tipos_clase"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_clase_id_clases_id_fk" FOREIGN KEY ("clase_id") REFERENCES "public"."clases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_user_id_usuarios_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cuentas_user_id_index" ON "cuentas" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clase_por_plantilla" ON "clases" USING btree ("plantilla_id","inicia_en");--> statement-breakpoint
CREATE INDEX "clases_inicia_en_index" ON "clases" USING btree ("inicia_en");--> statement-breakpoint
CREATE INDEX "emails_estado_creado_en_index" ON "emails" USING btree ("estado","creado_en");--> statement-breakpoint
CREATE UNIQUE INDEX "espera_activa_por_alumno" ON "lista_espera" USING btree ("usuario_id","clase_id") WHERE "lista_espera"."estado" in ('esperando', 'oferta');--> statement-breakpoint
CREATE UNIQUE INDEX "espera_posicion" ON "lista_espera" USING btree ("clase_id","posicion");--> statement-breakpoint
CREATE INDEX "movimientos_credito_usuario_id_creado_en_index" ON "movimientos_credito" USING btree ("usuario_id","creado_en");--> statement-breakpoint
CREATE INDEX "movimientos_credito_pack_id_index" ON "movimientos_credito" USING btree ("pack_id");--> statement-breakpoint
CREATE INDEX "packs_usuario_id_estado_index" ON "packs" USING btree ("usuario_id","estado");--> statement-breakpoint
CREATE INDEX "pagos_usuario_id_index" ON "pagos" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "pagos_estado_creado_en_index" ON "pagos" USING btree ("estado","creado_en");--> statement-breakpoint
CREATE INDEX "pagos_id_externo_index" ON "pagos" USING btree ("id_externo");--> statement-breakpoint
CREATE UNIQUE INDEX "reserva_activa_por_alumno" ON "reservas" USING btree ("usuario_id","clase_id") WHERE "reservas"."estado" in ('pendiente_pago', 'confirmada', 'asistio');--> statement-breakpoint
CREATE UNIQUE INDEX "reformer_activo_por_clase" ON "reservas" USING btree ("clase_id","reformer") WHERE "reservas"."estado" in ('pendiente_pago', 'confirmada', 'asistio');--> statement-breakpoint
CREATE INDEX "reservas_clase_id_estado_index" ON "reservas" USING btree ("clase_id","estado");--> statement-breakpoint
CREATE INDEX "reservas_usuario_id_index" ON "reservas" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "sesiones_user_id_index" ON "sesiones" USING btree ("user_id");