'use strict';

/**
 * Migration: add needMoreInfoNote column to reports table.
 * Uses ADD COLUMN IF NOT EXISTS so it is safe to run even if the column
 * already exists in a database that was previously synced via alter:true.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE reports
        ADD COLUMN IF NOT EXISTS "needMoreInfoNote" TEXT NOT NULL DEFAULT '';
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE reports DROP COLUMN IF EXISTS "needMoreInfoNote";
    `);
  },
};
