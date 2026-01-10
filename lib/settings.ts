import { prisma } from './prisma'

// Default settings
const DEFAULT_SETTINGS = {
  lottery_limit_enabled: 'false',
  lottery_daily_limit: '3',
  vip_unlimited: 'true',
}

/**
 * Helper function to get a specific setting value
 */
export async function getSetting(key: string): Promise<string | null> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key },
    })
    return setting?.value || DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS] || null
  } catch (error) {
    console.error('Error getting setting:', error)
    return DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS] || null
  }
}

/**
 * Helper function to get all settings
 */
export async function getAllSettings(): Promise<Record<string, string>> {
  try {
    const settings = await prisma.systemSetting.findMany()
    
    // Convert to key-value object
    const settingsObj: Record<string, string> = { ...DEFAULT_SETTINGS }
    settings.forEach(setting => {
      settingsObj[setting.key] = setting.value
    })

    return settingsObj
  } catch (error) {
    console.error('Error getting all settings:', error)
    return DEFAULT_SETTINGS
  }
}

/**
 * Helper function to update a setting
 */
export async function updateSetting(key: string, value: string): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })
}

/**
 * Helper function to update multiple settings
 */
export async function updateSettings(settings: Record<string, string>): Promise<void> {
  for (const [key, value] of Object.entries(settings)) {
    await updateSetting(key, String(value))
  }
}
