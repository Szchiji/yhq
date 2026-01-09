// 系统内置按钮动作
export const BUILTIN_BUTTON_ACTIONS = [
  { value: 'join_lottery', label: '参与抽奖' },
  { value: 'view_details', label: '查看详情' },
  { value: 'share', label: '分享' },
] as const

export type BuiltinButtonAction = typeof BUILTIN_BUTTON_ACTIONS[number]['value']
