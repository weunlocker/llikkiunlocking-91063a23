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
  result?: string
  charged?: string | number
  balance?: string | number
}

function stripColorMarkers(text?: string): string {
  if (!text) return "";
  return text.replace(/\[\[\/?[cf](?::[^\]]+)?\]\]/g, "");
}



const OrderSuccessEmail = ({ name, orderNumber, service, imei, result, charged, balance }: Props) => (
  <EmailShell preview={`Your order #${orderNumber ?? ''} is complete`}>
    <span style={{ ...styles.badge, background: '#DCFCE7', color: '#15803D' }}>✓ ORDER COMPLETED</span>
    <Heading style={{ ...styles.h1, marginTop: 12 }}>Hi{name ? ` ${name}` : ''}, your order is ready!</Heading>
    <Text style={styles.text}>
      Great news — your {BRAND.name} order has been processed successfully. Details below:
    </Text>
    <div style={styles.infoBox}>
      {orderNumber !== undefined && <Text style={styles.row}><span style={styles.rowKey}>Order #:</span> {orderNumber}</Text>}
      {service && <Text style={styles.row}><span style={styles.rowKey}>Service:</span> {service}</Text>}
      {imei && <Text style={styles.row}><span style={styles.rowKey}>IMEI:</span> {imei}</Text>}
      {charged !== undefined && <Text style={styles.row}><span style={styles.rowKey}>Charged:</span> ${charged}</Text>}
      {balance !== undefined && <Text style={styles.row}><span style={styles.rowKey}>Wallet Balance:</span> ${balance}</Text>}
    </div>
    {result && (
      <div style={{ ...styles.infoBox, background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
        <Text style={{ ...styles.row, color: '#15803D', whiteSpace: 'pre-wrap' as const }}>
          <span style={styles.rowKey}>Result:</span><br />{stripColorMarkers(result)}
        </Text>
      </div>
    )}
    {ctaButton(`${BRAND.url}/dashboard`, 'View in Dashboard')}
    <Text style={styles.small}>Thanks for choosing {BRAND.name}. Place your next order anytime.</Text>
  </EmailShell>
)

export const template = {
  component: OrderSuccessEmail,
  subject: (d: Record<string, any>) => `✅ Order #${d.orderNumber ?? ''} completed — ${BRAND.name}`,
  displayName: 'Order success',
  previewData: { name: 'Alex', orderNumber: 'LK-10245', service: 'iPhone iCloud Removal', imei: '356789123456789', result: 'Unlock successful. Device is now clean.', charged: 12.5, balance: 47.5 },
} satisfies TemplateEntry
