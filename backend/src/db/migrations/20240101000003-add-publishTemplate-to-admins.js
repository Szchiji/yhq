const { DEFAULT_PUBLISH_TEMPLATE } = require('../../utils/renderTemplate');

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('admins');
    if (!tableDescription.publishTemplate) {
      await queryInterface.addColumn('admins', 'publishTemplate', {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: DEFAULT_PUBLISH_TEMPLATE,
      });
    }
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('admins', 'publishTemplate');
  },
};
