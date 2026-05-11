/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Heading, Text } from 'npm:@react-email/components@0.0.22'
import { EmailShell, ctaButton, styles, BRAND } from '../email-templates/_layout.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  name?: string
  orderNumber?: string | number
  service?: string
  imei?: string
  error?: string
  refund?: string | number
  balance?: string | number
}

const OrderRejectedEmail = ({ name, orderNumber, service, imei, error, refund, balance }: Props) => (
  <EmailShell preview={`Your order #${orderNumber ?? ''} was rejected`}>
    <span style={{ ...styles.badge, background: '#FEE2E2', color: '#B91C1C' }}>✕ ORDER REJECTED</span>
    <Heading style={{ ...styles.h1, marginTop: 12 }}>Hi{name ? ` ${name}` : ''}, your order couldn't be completed</Heading>
    <Text style={styles.text}>
      Unfortunately, the supplier rejected your order. Don't worry — your funds have been refunded automatically.
    </Text>
    <div style={styles.infoBox}>
      {orderNumber !== undefined && <Text style={styles.row}><span style={styles.rowKey}>Order #:</span> {orderNumber}</Text>}
      {service && <Text style={styles.row}><span style={styles.rowKey}>Service:</span> {service}</Text>}
      {imei && <Text style={styles.row}><span style={styles.rowKey}>IMEI:</span> {imei}</Text>}
      {refund !== undefined && <Text style={styles.row}><span style={styles.rowKey}>Refund:</span> ${refund}</Text>}
      {balance !== undefined && <Text style={styles.row}><span style={styles.rowKey}>Wallet Balance:</span> ${balance}</Text>}
    </div>
    {error && (
      <div style={{ ...styles.infoBox, background: '#FEF2F2', border: '1px solid #FECACA' }}>
        <Text style={{ ...styles.row, color: '#B91C1C' }}>
          <span style={styles.rowKey}>Reason:</span> {error}
        </Text>
      </div>
    )}
    {ctaButton(`${BRAND.url}/services`, 'Try Another Service')}
    <Text style={styles.small}>Questions? Reply to this email and our team will help you out.</Text>
  </EmailShell>
)

export const template = {
  component: OrderRejectedEmail,
  subject: (d: Record<string, any>) => `❌ Order #${d.orderNumber ?? ''} rejected & refunded — ${BRAND.name}`,
  displayName: 'Order rejected',
  previewData: { name: 'Alex', orderNumber: 'LK-10246', service: 'Samsung Network Unlock', imei: '356789123456789', error: 'Device not supported by this server.', refund: 8, balance: 55.5 },
} satisfies TemplateEntry
