import type { MigrationBuilder } from "node-pg-migrate";

import {
  DATABASE_CAMPAIGN_OWNERSHIP_CONTRACT_INSERT_SQL,
  DATABASE_CAMPAIGN_OWNERSHIP_INDEX_SQL,
  DATABASE_CAMPAIGN_OWNERSHIP_RESTORE_ACCESS_CONTRACT_SQL,
  DATABASE_CAMPAIGN_OWNERSHIP_SUPERSEDE_ACCESS_CONTRACT_SQL,
  DATABASE_CAMPAIGN_OWNERSHIP_TABLE_SQL,
} from "../migration-manifest.js";

export const shorthands = undefined;

export function up(pgm: MigrationBuilder): void {
  pgm.sql(DATABASE_CAMPAIGN_OWNERSHIP_TABLE_SQL);
  pgm.sql(DATABASE_CAMPAIGN_OWNERSHIP_INDEX_SQL);
  pgm.sql(DATABASE_CAMPAIGN_OWNERSHIP_SUPERSEDE_ACCESS_CONTRACT_SQL);
  pgm.sql(DATABASE_CAMPAIGN_OWNERSHIP_CONTRACT_INSERT_SQL);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql("DELETE FROM infra.migration_contracts WHERE migration_id = 5;");
  pgm.sql("DROP TABLE app.campaigns RESTRICT;");
  pgm.sql(DATABASE_CAMPAIGN_OWNERSHIP_RESTORE_ACCESS_CONTRACT_SQL);
}
