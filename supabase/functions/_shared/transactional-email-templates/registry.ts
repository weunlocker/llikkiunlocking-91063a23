/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as welcome } from './welcome.tsx'
import { template as orderPlaced } from './order-placed.tsx'
import { template as orderSuccess } from './order-success.tsx'
import { template as orderRejected } from './order-rejected.tsx'
import { template as balanceTopup } from './balance-topup.tsx'
import { template as referralBonus } from './referral-bonus.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'welcome': welcome,
  'order-placed': orderPlaced,
  'order-success': orderSuccess,
  'order-rejected': orderRejected,
  'balance-topup': balanceTopup,
  'referral-bonus': referralBonus,
}
