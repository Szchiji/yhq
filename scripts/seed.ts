import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 开始初始化数据库...')

  // Check if admin already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { username: 'admin' },
  })

  if (existingAdmin) {
    console.log('⚠️  管理员账号已存在，跳过创建')
    return
  }

  // Create default superadmin
  // Note: Using a simple default password for easy initial setup
  // Users MUST change this password after first login
  const hashedPassword = await hash('admin123', 10)
  await prisma.user.create({
    data: {
      username: 'admin',
      password: hashedPassword,
      role: 'SUPERADMIN',
      isActive: true,
    },
  })

  console.log('✅ 默认管理员账号创建成功！')
  console.log('📝 登录信息：')
  console.log('   用户名: admin')
  console.log('   密码: admin123')
  console.log('   角色: 超级管理员')
  console.log('')
  console.log('⚠️  请在首次登录后立即修改默认密码！')
}

main()
  .catch((e) => {
    console.error('❌ 数据库初始化失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
