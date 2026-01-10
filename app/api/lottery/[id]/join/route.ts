import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkChatMember } from '@/lib/telegram'
import { checkAndDraw } from '@/lib/lottery'

type Params = {
  params: {
    id: string
  }
}

// POST - 用户参与抽奖
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const body = await request.json()
    const { telegramId, username, firstName, lastName, invitedBy } = body

    if (!telegramId) {
      return NextResponse.json({ error: 'Missing telegramId' }, { status: 400 })
    }

    // Check participation limits
    const user = await prisma.user.findUnique({
      where: { telegramId }
    })

    // Check if user can participate based on VIP status and daily limits
    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: ['lottery_limit_enabled', 'lottery_daily_limit', 'vip_unlimited'] } }
    })
    
    const limitEnabled = settings.find(s => s.key === 'lottery_limit_enabled')?.value === 'true'
    const dailyLimit = parseInt(settings.find(s => s.key === 'lottery_daily_limit')?.value || '3')
    const vipUnlimited = settings.find(s => s.key === 'vip_unlimited')?.value !== 'false'

    if (limitEnabled) {
      const isVip = user?.isVip || false
      const vipExpireAt = user?.vipExpireAt
      const vipValid = isVip && (!vipExpireAt || new Date(vipExpireAt) > new Date())

      // Check if VIP users are unlimited
      if (!vipValid || !vipUnlimited) {
        // Check daily limit for non-VIP or if VIP unlimited is disabled
        if (!vipValid) {
          const dailyJoinCount = user?.dailyJoinCount || 0
          const dailyJoinResetAt = user?.dailyJoinResetAt
          
          // Reset count if it's a new day
          const now = new Date()
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          const shouldReset = !dailyJoinResetAt || new Date(dailyJoinResetAt) < today

          if (shouldReset) {
            // Reset the count
            if (user) {
              await prisma.user.update({
                where: { telegramId },
                data: { 
                  dailyJoinCount: 0,
                  dailyJoinResetAt: now
                }
              })
            }
          } else if (dailyJoinCount >= dailyLimit) {
            return NextResponse.json({ 
              error: 'Daily limit exceeded',
              message: `您今日的参与次数已用完（${dailyLimit}次/天）。升级VIP可无限参与！`
            }, { status: 400 })
          }
        }
      }
    }

    // 获取抽奖信息
    const lottery = await prisma.lottery.findUnique({
      where: { id: params.id },
      include: {
        participants: true,
        channels: true,
      },
    })

    if (!lottery) {
      return NextResponse.json({ error: 'Lottery not found' }, { status: 404 })
    }

    if (lottery.status !== 'active') {
      return NextResponse.json({ error: 'Lottery is not active' }, { status: 400 })
    }

    // 检查是否已参与
    const existingParticipant = lottery.participants.find(
      p => p.telegramId === telegramId
    )
    if (existingParticipant) {
      return NextResponse.json({ error: 'Already participated' }, { status: 400 })
    }

    // 检查参与条件：用户名
    if (lottery.requireUsername && !username) {
      return NextResponse.json({ 
        error: 'Username required',
        message: '参与此抽奖需要设置 Telegram 用户名'
      }, { status: 400 })
    }

    // 检查参与条件：频道加入（使用新的 channels 关联或旧的 requireChannels 数组）
    const channelsToCheck = lottery.channels && lottery.channels.length > 0 
      ? lottery.channels.map(c => c.chatId)
      : (lottery.requireChannels && lottery.requireChannels.length > 0 ? lottery.requireChannels : [])
    
    if (channelsToCheck.length > 0) {
      const channelChecks = await Promise.all(
        channelsToCheck.map(channelId => 
          checkChatMember(channelId, telegramId)
        )
      )
      
      if (channelChecks.some(result => !result)) {
        return NextResponse.json({ 
          error: 'Channel membership required',
          message: '参与此抽奖需要加入指定的频道/群组',
          requiredChannels: lottery.channels && lottery.channels.length > 0 
            ? lottery.channels.map(c => ({ id: c.chatId, title: c.title }))
            : channelsToCheck
        }, { status: 400 })
      }
    }

    // 创建参与记录
    const participant = await prisma.participant.create({
      data: {
        lotteryId: params.id,
        telegramId,
        username,
        firstName,
        lastName,
        invitedBy,
      },
    })

    // 如果有邀请者，更新邀请者的邀请数量
    if (invitedBy) {
      await prisma.participant.updateMany({
        where: {
          lotteryId: params.id,
          telegramId: invitedBy,
        },
        data: {
          inviteCount: {
            increment: 1,
          },
        },
      })
    }

    // Increment daily join count if limit is enabled
    if (limitEnabled) {
      const isVip = user?.isVip || false
      const vipExpireAt = user?.vipExpireAt
      const vipValid = isVip && (!vipExpireAt || new Date(vipExpireAt) > new Date())

      // Only increment for non-VIP users or if VIP unlimited is disabled
      if (!vipValid || !vipUnlimited) {
        if (!vipValid) {
          // Update or create user record with incremented count
          if (user) {
            await prisma.user.update({
              where: { telegramId },
              data: { 
                dailyJoinCount: { increment: 1 }
              }
            })
          } else {
            await prisma.user.create({
              data: {
                telegramId,
                username,
                firstName,
                lastName,
                dailyJoinCount: 1,
                dailyJoinResetAt: new Date()
              }
            })
          }
        }
      }
    }

    // 检查是否触发人满开奖
    await checkAndDraw(params.id)

    return NextResponse.json({ 
      success: true,
      participant,
      message: '参与成功！'
    }, { status: 201 })
  } catch (error) {
    console.error('Error joining lottery:', error)
    return NextResponse.json({ error: 'Failed to join lottery' }, { status: 500 })
  }
}
