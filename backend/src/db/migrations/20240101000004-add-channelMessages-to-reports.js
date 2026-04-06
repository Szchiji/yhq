'use strict';

/**
 * Migration: add channelMessages and channelMessageId columns to reports table.
 * Uses ADD COLUMN IF NOT EXISTS so it is safe to run even if the columns
 * already exist in a database that was previously synced via alter:true or
 * patched manually with ALTER TABLE.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE reports
        ADD COLUMN IF NOT EXISTS "channelMessages" JSONB NOT NULL DEFAULT '[]'::jsonb;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE reports
        ADD COLUMN IF NOT EXISTS "channelMessageId" BIGINT;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE reports DROP COLUMN IF EXISTS "channelMessages";
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE reports DROP COLUMN IF EXISTS "channelMessageId";
    `);
  },
};
