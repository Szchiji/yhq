const DEFAULT_PUBLISH_TEMPLATE =
  '📋 *报告推送* No.{{reportNumber}}\n\n' +
  '👤 @{{username}}\n' +
  '📌 {{title}}\n\n' +
  '{{description}}\n\n' +
  '{{tags}}{{url}}';

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
