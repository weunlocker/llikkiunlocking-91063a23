/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Heading, Text } from 'npm:@react-email/components@0.0.22'
import { EmailShell, ctaButton, styles, BRAND } from '../email-templates/_layout.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  name?: string
  amount?: string | number
  balance?: string | number
  method?: string
  reference?: string
}

const BalanceTopupEmail = ({ name, amount, balance, method, reference }: Props) => (
  <EmailShell preview={`Wallet credited with $${amount ?? ''}`}>
    <span style={{ ...styles.badge, background: '#DCFCE7', color: '#15803D' }}>💰 WALLET CREDITED</span>
    <Heading style={{ ...styles.h1, marginTop: 12 }}>Hi{name ? ` ${name}` : ''}, your top-up is in!</Heading>
    <Text style={styles.text}>
      Your {BRAND.name} wallet has been topped up successfully. You can place orders right away.
    </Text>
    <div style={styles.infoBox}>
      {amount !== undefined && <Text style={styles.row}><span style={styles.rowKey}>Amount added:</span> ${amount}</Text>}
      {balance !== undefined && <Text style={styles.row}><span style={styles.rowKey}>New balance:</span> ${balance}</Text>}
      {method && <Text style={styles.row}><span style={styles.rowKey}>Method:</span> {method}</Text>}
      {reference && <Text style={styles.row}><span style={styles.rowKey}>Reference:</span> {reference}</Text>}
    </div>
    {ctaButton(`${BRAND.url}/dashboard?tab=wallet`, 'Open Wallet')}
    <Text style={styles.small}>If this wasn't you, please contact support immediately.</Text>
  </EmailShell>
)

export const template = {
  component: BalanceTopupEmail,
  subject: (d: Record<string, any>) => `💰 $${d.amount ?? ''} added to your wallet — ${BRAND.name}`,
  displayName: 'Balance top-up',
  previewData: { name: 'Alex', amount: 20, balance: 67.5, method: 'Binance Pay (USDT)', reference: 'LK-A1B2C3' },
} satisfies TemplateEntry
