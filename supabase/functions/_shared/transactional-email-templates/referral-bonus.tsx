/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Heading, Text } from 'npm:@react-email/components@0.0.22'
import { EmailShell, ctaButton, styles, BRAND } from '../email-templates/_layout.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  name?: string
  referredName?: string
  bonus?: string | number
  topupAmount?: string | number
  percent?: string | number
  balance?: string | number
}

const ReferralBonusEmail = ({ name, referredName, bonus, topupAmount, percent, balance }: Props) => (
  <EmailShell preview={`You earned $${bonus ?? ''} referral bonus`}>
    <span style={{ ...styles.badge, background: '#FEF3C7', color: '#92400E' }}>🎁 REFERRAL BONUS</span>
    <Heading style={{ ...styles.h1, marginTop: 12 }}>Cha-ching{name ? `, ${name}` : ''}!</Heading>
    <Text style={styles.text}>
      Your friend{referredName ? ` ${referredName}` : ''} just topped up their {BRAND.name} wallet — and you earned a commission.
    </Text>
    <div style={styles.infoBox}>
      {bonus !== undefined && <Text style={styles.row}><span style={styles.rowKey}>Bonus earned:</span> ${bonus}</Text>}
      {topupAmount !== undefined && <Text style={styles.row}><span style={styles.rowKey}>Their top-up:</span> ${topupAmount}</Text>}
      {percent !== undefined && <Text style={styles.row}><span style={styles.rowKey}>Rate:</span> {percent}%</Text>}
      {balance !== undefined && <Text style={styles.row}><span style={styles.rowKey}>Your new balance:</span> ${balance}</Text>}
    </div>
    {ctaButton(`${BRAND.url}/dashboard?tab=referrals`, 'View Referrals')}
    <Text style={styles.small}>Keep sharing your referral link to earn more on every top-up.</Text>
  </EmailShell>
)

export const template = {
  component: ReferralBonusEmail,
  subject: (d: Record<string, any>) => `🎁 You earned $${d.bonus ?? ''} referral bonus — ${BRAND.name}`,
  displayName: 'Referral bonus',
  previewData: { name: 'Alex', referredName: 'Sam', bonus: 2, topupAmount: 20, percent: 10, balance: 47.5 },
} satisfies TemplateEntry
