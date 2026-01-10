import { prisma } from './prisma'

/**
 * Initialize database with default settings and commands
 * This ensures that all required database tables exist and have default data
 */
export async function initDatabase() {
  try {
    console.log('Starting database initialization...')
    
    // Check and create default system settings
    const defaultSettings = [
      { key: 'lottery_limit_enabled', value: 'false' },
      { key: 'lottery_daily_limit', value: '3' },
      { key: 'vip_unlimited', value: 'true' },
    ]
    
    for (const setting of defaultSettings) {
      try {
        await prisma.systemSetting.upsert({
          where: { key: setting.key },
          update: {},
          create: setting,
        })
        console.log(`✓ System setting initialized: ${setting.key}`)
      } catch (error) {
        console.error(`Error initializing setting ${setting.key}:`, error)
      }
    }
    
    // Check and create default commands
    const defaultCommands = [
      { command: '/start', prompt: '开始', description: '开始使用机器人', sortOrder: 10 },
      { command: '/new', prompt: '创建抽奖', description: '创建新的抽奖活动', sortOrder: 20 },
      { command: '/mylottery', prompt: '我的抽奖', description: '查看我的抽奖', sortOrder: 30 },
      { command: '/vip', prompt: 'VIP会员', description: '查看VIP状态', sortOrder: 40 },
      { command: '/bot', prompt: '管理后台', description: '打开管理后台', sortOrder: 50 },
    ]
    
    for (const cmd of defaultCommands) {
      try {
        await prisma.botCommand.upsert({
          where: { command: cmd.command },
          update: {},
          create: { ...cmd, isEnabled: true },
        })
        console.log(`✓ Bot command initialized: ${cmd.command}`)
      } catch (error) {
        console.error(`Error initializing command ${cmd.command}:`, error)
      }
    }
    
    console.log('✅ Database initialized successfully')
    return { success: true, message: 'Database initialized successfully' }
  } catch (error) {
    console.error('❌ Error initializing database:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Check if database is initialized
 * Returns true if essential tables exist and have data
 */
export async function checkDatabaseStatus() {
  try {
    // Check if SystemSetting table exists and has data
    const settingsCount = await prisma.systemSetting.count()
    
    // Check if BotCommand table exists and has data
    const commandsCount = await prisma.botCommand.count()
    
    return {
      initialized: settingsCount > 0 && commandsCount > 0,
      settingsCount,
      commandsCount,
    }
  } catch (error) {
    console.error('Error checking database status:', error)
    return {
      initialized: false,
      error: String(error),
    }
  }
}
