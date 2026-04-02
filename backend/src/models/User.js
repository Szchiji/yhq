const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

const User = sequelize.define('User', {
  userId: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    allowNull: false,
  },
  username: {
    type: DataTypes.STRING,
    defaultValue: '',
  },
  firstName: {
    type: DataTypes.STRING,
    defaultValue: '',
  },
  lastName: {
    type: DataTypes.STRING,
    defaultValue: '',
  },
  isSubscribed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  lastChecked: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  timestamps: true,
  tableName: 'users',
});

module.exports = User;
