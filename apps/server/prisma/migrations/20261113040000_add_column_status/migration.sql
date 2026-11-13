BEGIN;

CREATE TYPE "ColumnStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');
ALTER TABLE "BoardColumn" ADD COLUMN "status" "ColumnStatus" NOT NULL DEFAULT 'TODO';

-- Preserva a regra da Etapa 05 apenas no preenchimento inicial.
-- Depois desta migração, nome e posição não determinam o estado.
UPDATE "BoardColumn"
SET "status" = CASE
  WHEN "position" = 1 THEN 'IN_PROGRESS'::"ColumnStatus"
  WHEN "position" = 2 THEN 'DONE'::"ColumnStatus"
  ELSE 'TODO'::"ColumnStatus"
END;

COMMIT;
