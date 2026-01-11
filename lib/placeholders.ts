// 统一的占位符定义
export const PLACEHOLDERS = {
  // 抽奖基本信息
  lotterySn: { key: '{lotterySn}', name: '抽奖编号', description: '抽奖的唯一编号' },
  lotteryTitle: { key: '{lotteryTitle}', name: '抽奖标题', description: '抽奖活动的标题' },
  lotteryDesc: { key: '{lotteryDesc}', name: '抽奖说明', description: '抽奖活动的详细说明' },
  creator: { key: '{creator}', name: '创建者', description: '创建者的用户名 @username' },
  
  // 参与条件
  joinCondition: { key: '{joinCondition}', name: '参与条件', description: '需要加入的群组/频道列表' },
  
  // 奖品
  goodsList: { key: '{goodsList}', name: '奖品列表', description: '所有奖品的列表' },
  goodsName: { key: '{goodsName}', name: '奖品名称', description: '单个奖品的名称（用于中奖通知）' },
  
  // 开奖信息
  openCondition: { key: '{openCondition}', name: '开奖条件', description: '开奖方式和时间' },
  drawTime: { key: '{drawTime}', name: '开奖时间', description: '定时开奖的具体时间' },
  
  // 参与信息
  joinNum: { key: '{joinNum}', name: '参与人数', description: '当前参与抽奖的人数' },
  lotteryLink: { key: '{lotteryLink}', name: '参与链接', description: '参与抽奖的链接' },
  
  // 用户信息
  member: { key: '{member}', name: '用户', description: '用户昵称或用户名' },
  
  // 中奖信息
  awardUserList: { key: '{awardUserList}', name: '中奖名单', description: '所有中奖者的列表' },
}

// 按模板类型分组可用的占位符
export const TEMPLATE_PLACEHOLDERS = {
  // 编辑成功模板（推送模板）
  edit_success: [
    '{lotterySn}', '{lotteryTitle}', '{lotteryDesc}', '{creator}',
    '{joinCondition}', '{goodsList}', '{openCondition}', '{drawTime}',
    '{joinNum}', '{lotteryLink}'
  ],
  // 用户参与提示模板
  user_join_prompt: [
    '{lotterySn}', '{lotteryTitle}', '{lotteryDesc}', '{goodsList}',
    '{openCondition}', '{joinNum}', '{lotteryLink}'
  ],
  // 用户参加成功模板
  user_join_success: [
    '{lotterySn}', '{lotteryTitle}', '{member}', '{joinNum}'
  ],
  // 中奖私聊用户模板
  winner_private: [
    '{lotterySn}', '{lotteryTitle}', '{member}', '{goodsName}'
  ],
  // 中奖私聊创建人模板
  creator_private: [
    '{lotterySn}', '{lotteryTitle}', '{awardUserList}', '{joinNum}'
  ],
  // 中奖公开通知模板
  winner_public: [
    '{lotterySn}', '{lotteryTitle}', '{awardUserList}', '{joinNum}'
  ],
  // 抽奖创建成功通知模板
  lottery_created: [
    '{lotterySn}', '{lotteryTitle}', '{goodsList}', '{openCondition}', '{drawTime}'
  ],
}

// 默认模板
export function getDefaultTemplate(type: string): string {
  const defaults: Record<string, string> = {
    edit_success: `🎁 抽奖标题：{lotteryTitle}

📦 抽奖说明：
{lotteryDesc}

🎫 参与条件：
{joinCondition}

🎁 奖品内容：
{goodsList}

📅 开奖条件：{openCondition}
👉 参与抽奖链接：{lotteryLink}`,

    user_join_prompt: `📢 {lotteryTitle}

{lotteryDesc}

🎁 奖品：{goodsList}
⏰ 开奖：{openCondition}
👥 已参与：{joinNum} 人

点击下方按钮参与抽奖！`,

    user_join_success: `✅ 参与成功！

您已成功参与抽奖：{lotteryTitle}
当前参与人数：{joinNum}

请耐心等待开奖结果！`,

    winner_private: `🎉 恭喜 {member}！

您在抽奖「{lotteryTitle}」中中奖了！
🎁 奖品：{goodsName}

请联系管理员领取奖品。`,

    creator_private: `📊 抽奖开奖通知

抽奖「{lotteryTitle}」已开奖！
参与人数：{joinNum}

中奖名单：
{awardUserList}`,

    winner_public: `🎊 开奖结果公布

抽奖「{lotteryTitle}」已开奖！

中奖名单：
{awardUserList}

恭喜以上中奖者！`,

    lottery_created: `✅ 抽奖创建成功！

📋 标题：{lotteryTitle}
🎁 奖品：{goodsList}
🎯 开奖：{openCondition}
📅 创建：{drawTime}

点击下方按钮进行操作。`,
  }
  
  return defaults[type] || ''
}

// 统一的模板变量替换函数
export function replaceAllPlaceholders(
  template: string, 
  data: {
    lotterySn?: string
    lotteryTitle?: string
    lotteryDesc?: string
    creator?: string
    joinCondition?: string
    goodsList?: string
    goodsName?: string
    openCondition?: string
    drawTime?: string
    joinNum?: number | string
    lotteryLink?: string
    member?: string
    awardUserList?: string
  }
): string {
  let result = template
  
  if (data.lotterySn !== undefined) result = result.replace(/{lotterySn}/g, data.lotterySn || '')
  if (data.lotteryTitle !== undefined) result = result.replace(/{lotteryTitle}/g, data.lotteryTitle || '')
  if (data.lotteryDesc !== undefined) result = result.replace(/{lotteryDesc}/g, data.lotteryDesc || '')
  if (data.creator !== undefined) result = result.replace(/{creator}/g, data.creator || '')
  if (data.joinCondition !== undefined) result = result.replace(/{joinCondition}/g, data.joinCondition || '')
  if (data.goodsList !== undefined) result = result.replace(/{goodsList}/g, data.goodsList || '')
  if (data.goodsName !== undefined) result = result.replace(/{goodsName}/g, data.goodsName || '')
  if (data.openCondition !== undefined) result = result.replace(/{openCondition}/g, data.openCondition || '')
  if (data.drawTime !== undefined) result = result.replace(/{drawTime}/g, data.drawTime || '')
  if (data.joinNum !== undefined) result = result.replace(/{joinNum}/g, String(data.joinNum))
  if (data.lotteryLink !== undefined) result = result.replace(/{lotteryLink}/g, data.lotteryLink || '')
  if (data.member !== undefined) result = result.replace(/{member}/g, data.member || '')
  if (data.awardUserList !== undefined) result = result.replace(/{awardUserList}/g, data.awardUserList || '')
  
  return result
}
