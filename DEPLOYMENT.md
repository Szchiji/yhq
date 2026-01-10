# 系统升级部署指南

本指南说明如何部署和配置完整的系统升级。

## 一、环境变量配置

更新 `.env` 文件，添加以下配置：

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/yhq?schema=public"

# Telegram Bot
BOT_TOKEN="your-telegram-bot-token"

# 多个超管ID，用逗号分隔
SUPER_ADMIN_IDS="123456789,987654321,111222333"

WEBAPP_URL="https://your-domain.railway.app"
```

## 二、数据库迁移

### 1. 推送新的数据库模式

```bash
npm run db:push
```

这将应用以下schema变更：
- User表添加：`vipPlanId`, `dailyJoinCount`, `dailyJoinResetAt` 字段
- 新增 `VipPlan` 模型（VIP套餐）
- 新增 `VipOrder` 模型（VIP订单）
- 新增 `SystemSetting` 模型（系统设置）

### 2. 初始化默认数据

```bash
npm run db:seed
```

这将初始化：
- 6个默认Telegram命令（包括新的 `/vip` 命令）
- 4个默认VIP套餐（月卡、季卡、年卡、永久）
- 3个系统设置项（参与限制开关、每日限制次数、VIP无限制）

## 三、新功能说明

### 1. 模板系统完善

- ✅ 统一占位符定义（`lib/placeholders.ts`）
- ✅ 占位符带中文说明
- ✅ 按钮编辑器支持（`components/ButtonEditor.tsx`）
- ✅ 系统内置按钮（参与抽奖、查看详情、分享）
- ✅ 模板内容引用和替换

### 2. 私聊命令管理

- ✅ 数据库模型：`BotCommand`
- ✅ 默认命令：`/start`, `/new`, `/create`, `/newinvite`, `/mylottery`, `/vip`
- ✅ 管理页面：`/commands`
- ✅ 同步到Telegram：点击"同步到Telegram"按钮

### 3. 公告群/频道（超管专属）

- ✅ 数据库模型：`AnnouncementChannel`
- ✅ 管理页面：`/announcements`
- ✅ 抽奖创建后自动推送到所有公告群/频道（`lib/lottery.ts`）

### 4. VIP续费系统

#### VIP套餐管理
- ✅ 页面路径：`/billing/plans`
- ✅ API路由：`/api/vip-plans`
- ✅ 默认套餐：月卡、季卡、年卡、永久

#### 订单管理
- ✅ 页面路径：`/billing/orders`（待完成）
- ✅ API路由：`/api/orders`
- ✅ 订单状态：pending, paid, cancelled

#### /vip 命令
- ✅ 显示VIP状态和到期时间
- ✅ 显示今日剩余参与次数（非VIP用户）
- ✅ 展示所有可用VIP套餐
- ✅ 点击套餐查看详情

### 5. 用户管理增强

- ✅ 数据库字段：`isVip`, `vipExpireAt`, `vipPlanId`
- ✅ 每日参与限制：`dailyJoinCount`, `dailyJoinResetAt`
- ✅ 权限控制：`canCreateLottery`, `canJoinLottery`

### 6. 系统设置（超管专属）

- ✅ 页面路径：`/settings`
- ✅ API路由：`/api/settings`
- ✅ 设置项：
  - `lottery_limit_enabled` - 启用抽奖限制
  - `lottery_daily_limit` - 每日参与次数（默认3次）
  - `vip_unlimited` - VIP无限制（默认true）

### 7. 多超管支持

- ✅ 环境变量：`SUPER_ADMIN_IDS`（逗号分隔）
- ✅ 权限模块：`lib/auth.ts`
- ✅ 向后兼容：支持旧的 `SUPER_ADMIN_ID`

### 8. 权限分级

**超管权限：**
- 所有管理功能
- 公告群设置
- 私聊命令管理
- 系统设置
- 管理员管理

**普通管理员权限：**
- 抽奖列表
- 消息模板
- 用户管理
- VIP套餐管理
- 订单管理

### 9. 抽奖参与限制

- ✅ 检查每日参与次数限制
- ✅ VIP用户无限制参与
- ✅ 自动重置每日计数
- ✅ 友好的错误提示

## 四、部署步骤

### 1. 更新代码

```bash
git pull origin main
npm install
```

### 2. 配置环境变量

确保 `.env` 文件包含所有必需的环境变量，特别是 `SUPER_ADMIN_IDS`。

### 3. 数据库迁移

```bash
# 推送schema变更
npm run db:push

# 初始化默认数据
npm run db:seed
```

### 4. 同步Telegram命令

部署完成后：
1. 以超管身份打开Bot
2. 访问管理后台 → 私聊命令管理
3. 点击"🔄 同步到Telegram"按钮
4. 确认同步成功

### 5. 配置公告群/频道（可选）

1. 以超管身份访问 `/announcements`
2. 添加公告群或频道
3. 确保Bot是管理员
4. 新创建的抽奖会自动推送到这些群/频道

### 6. 配置系统设置

1. 以超管身份访问 `/settings`
2. 根据需要调整参与限制设置
3. 保存设置

## 五、测试清单

- [ ] 超管和普通管理员登录，确认菜单显示正确
- [ ] 访问各个新增页面，确认功能正常
- [ ] 创建VIP套餐，确认保存成功
- [ ] 发送 `/vip` 命令，确认显示正确
- [ ] 创建抽奖，确认自动推送到公告群
- [ ] 非VIP用户参与抽奖，测试每日限制
- [ ] VIP用户参与抽奖，确认无限制
- [ ] 同步命令到Telegram，确认Bot命令列表更新
- [ ] 修改系统设置，确认保存和生效

## 六、故障排查

### 数据库连接失败
- 检查 `DATABASE_URL` 是否正确
- 确认数据库服务运行正常
- 检查防火墙设置

### 命令同步失败
- 检查 `BOT_TOKEN` 是否正确
- 确认Bot有足够的权限
- 查看控制台错误日志

### 权限问题
- 确认 `SUPER_ADMIN_IDS` 配置正确
- 清除浏览器缓存重新登录
- 检查数据库 Admin 表

### VIP功能不生效
- 运行 `db:seed` 初始化系统设置
- 检查 `/settings` 页面配置
- 查看数据库 SystemSetting 表

## 七、后续优化建议

1. **订单管理页面**：完成 `/billing/orders` 页面UI
2. **用户管理增强**：添加VIP设置和权限控制界面
3. **模板编辑器**：在 `/templates` 页面显示占位符说明
4. **抽奖编辑**：实现 `/lottery/[id]/edit` 编辑页面
5. **推送功能**：在抽奖列表添加"推送"按钮
6. **支付集成**：集成USDT支付网关
7. **统计报表**：VIP订单统计、抽奖数据分析
8. **通知系统**：VIP到期提醒、抽奖开奖通知

## 八、技术架构

```
yhq/
├── app/
│   ├── api/
│   │   ├── vip-plans/        # VIP套餐API
│   │   ├── orders/            # 订单API
│   │   ├── settings/          # 系统设置API
│   │   └── commands/sync/     # 命令同步API
│   ├── billing/
│   │   ├── plans/             # VIP套餐管理
│   │   └── orders/            # 订单管理（待完成）
│   ├── settings/              # 系统设置
│   └── commands/              # 命令管理
├── lib/
│   ├── auth.ts                # 权限管理
│   ├── placeholders.ts        # 占位符定义
│   ├── telegram.ts            # Telegram API
│   └── lottery.ts             # 抽奖逻辑
├── components/
│   ├── ButtonEditor.tsx       # 按钮编辑器
│   ├── PublishModal.tsx       # 推送弹窗
│   └── Sidebar.tsx            # 侧边栏菜单
└── prisma/
    ├── schema.prisma          # 数据库模式
    └── seed.ts                # 初始化脚本
```

## 九、联系支持

如有问题，请：
1. 查看控制台日志
2. 检查数据库状态
3. 参考故障排查章节
4. 联系技术支持
