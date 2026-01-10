// Prisma seed script to initialize default data
// Run with: npx prisma db seed

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // 1. Seed default bot commands
  console.log('📝 Seeding bot commands...')
  const defaultCommands = [
    {
      command: '/start',
      prompt: '开始',
      description: '',
      sortOrder: 10,
      isEnabled: true,
    },
    {
      command: '/new',
      prompt: '网页创建抽奖',
      description: '此命令可以创建抽奖',
      sortOrder: 20,
      isEnabled: true,
    },
    {
      command: '/create',
      prompt: '机器人创建抽奖',
      description: '通过对话方式完成抽奖创建',
      sortOrder: 20,
      isEnabled: true,
    },
    {
      command: '/newinvite',
      prompt: '创建邀请类型抽奖',
      description: '创建邀请类型抽奖',
      sortOrder: 30,
      isEnabled: true,
    },
    {
      command: '/mylottery',
      prompt: '我发起的抽奖',
      description: '查看我发起的抽奖活动',
      sortOrder: 40,
      isEnabled: true,
    },
    {
      command: '/vip',
      prompt: 'VIP会员',
      description: '查看VIP状态和续费',
      sortOrder: 50,
      isEnabled: true,
    },
  ]

  for (const cmd of defaultCommands) {
    await prisma.botCommand.upsert({
      where: { command: cmd.command },
      update: cmd,
      create: cmd,
    })
  }
  console.log(`✅ Seeded ${defaultCommands.length} bot commands`)

  // 2. Seed default VIP plans
  console.log('💎 Seeding VIP plans...')
  const defaultPlans = [
    {
      name: '月卡',
      days: 30,
      price: '9.9',
      currency: 'USDT',
      description: '30天VIP会员，享受无限制权益',
      sortOrder: 10,
      isEnabled: true,
    },
    {
      name: '季卡',
      days: 90,
      price: '24.9',
      currency: 'USDT',
      description: '90天VIP会员，享受无限制权益',
      sortOrder: 20,
      isEnabled: true,
    },
    {
      name: '年卡',
      days: 365,
      price: '79.9',
      currency: 'USDT',
      description: '365天VIP会员，享受无限制权益',
      sortOrder: 30,
      isEnabled: true,
    },
    {
      name: '永久',
      days: -1,
      price: '199',
      currency: 'USDT',
      description: '永久VIP会员，终身享受无限制权益',
      sortOrder: 40,
      isEnabled: true,
    },
  ]

  // Get super admin ID from env for createdBy
  const superAdminId = process.env.SUPER_ADMIN_IDS?.split(',')[0] || process.env.SUPER_ADMIN_ID || 'system'

  for (const plan of defaultPlans) {
    await prisma.vipPlan.upsert({
      where: { name: plan.name },
      update: plan,
      create: { ...plan, createdBy: superAdminId },
    })
  }
  console.log(`✅ Seeded ${defaultPlans.length} VIP plans`)

  // 3. Seed default system settings
  console.log('⚙️  Seeding system settings...')
  const defaultSettings = [
    { key: 'lottery_limit_enabled', value: 'false' },
    { key: 'lottery_daily_limit', value: '3' },
    { key: 'vip_unlimited', value: 'true' },
  ]

  for (const setting of defaultSettings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    })
  }
  console.log(`✅ Seeded ${defaultSettings.length} system settings`)

  console.log('🎉 Database seed completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
