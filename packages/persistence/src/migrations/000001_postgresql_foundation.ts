import type { MigrationBuilder } from "node-pg-migrate";

import {
  DATABASE_BASELINE_ACTIVE_INDEX_SQL,
  DATABASE_BASELINE_CONTRACT_INSERT_SQL,
  DATABASE_BASELINE_TABLE_SQL,
} from "../migration-manifest.js";

export const shorthands = undefined;

export function up(pgm: MigrationBuilder): void {
  pgm.createExtension("vector");
  pgm.createSchema("app");
  pgm.sql(DATABASE_BASELINE_TABLE_SQL);
  pgm.sql(DATABASE_BASELINE_ACTIVE_INDEX_SQL);
  pgm.sql(DATABASE_BASELINE_CONTRACT_INSERT_SQL);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql("DROP TABLE infra.migration_contracts RESTRICT;");
  pgm.sql("DROP SCHEMA app RESTRICT;");
  pgm.sql("DROP EXTENSION vector RESTRICT;");
}
