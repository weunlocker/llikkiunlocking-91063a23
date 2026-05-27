/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Heading, Text } from 'npm:@react-email/components@0.0.22'
import { EmailShell, ctaButton, styles, BRAND } from '../email-templates/_layout.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  name?: string
  amount?: string | number
  balance?: string | number
  note?: string
}

const BalanceUpdateEmail = ({ name, amount, balance, note }: Props) => (
  <EmailShell preview={`Wallet balance updated${amount ? `: ${amount}` : ''}`}>
    <span style={{ ...styles.badge, background: '#E6F7FF', color: '#0066CC' }}>💳 BALANCE UPDATED</span>
    <Heading style={{ ...styles.h1, marginTop: 12 }}>Hi{name ? ` ${name}` : ''}, your wallet was updated</Heading>
    <Text style={styles.text}>
      Your {BRAND.name} wallet balance has been adjusted. The updated balance is available in your dashboard.
    </Text>
    <div style={styles.infoBox}>
      {amount !== undefined && <Text style={styles.row}><span style={styles.rowKey}>Adjustment:</span> {amount}</Text>}
      {balance !== undefined && <Text style={styles.row}><span style={styles.rowKey}>New balance:</span> {balance}</Text>}
      {note && <Text style={styles.row}><span style={styles.rowKey}>Note:</span> {note}</Text>}
    </div>
    {ctaButton(`${BRAND.url}/dashboard?tab=wallet`, 'Open Wallet')}
    <Text style={styles.small}>If you did not expect this change, please contact support immediately.</Text>
  </EmailShell>
)

export const template = {
  component: BalanceUpdateEmail,
  subject: (d: Record<string, any>) => `Wallet balance updated — ${d.amount ?? ''} ${BRAND.name}`,
  displayName: 'Balance update',
  previewData: { name: 'Alex', amount: '+$10.00', balance: '$42.50', note: 'Admin refill' },
} satisfies TemplateEntry