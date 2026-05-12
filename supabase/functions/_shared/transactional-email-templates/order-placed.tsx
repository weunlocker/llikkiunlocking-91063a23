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
  charged?: string | number
  balance?: string | number
}

const OrderPlacedEmail = ({ name, orderNumber, service, imei, charged, balance }: Props) => (
  <EmailShell preview={`Order #${orderNumber ?? ''} received — ${BRAND.name}`}>
    <span style={{ ...styles.badge, background: '#DBEAFE', color: '#1D4ED8' }}>● ORDER RECEIVED</span>
    <Heading style={{ ...styles.h1, marginTop: 12 }}>Hi{name ? ` ${name}` : ''}, we got your order!</Heading>
    <Text style={styles.text}>
      Thanks for your purchase. Your order is now being processed and you'll get another email the moment it's complete.
    </Text>
    <div style={styles.infoBox}>
      {orderNumber !== undefined && <Text style={styles.row}><span style={styles.rowKey}>Order #:</span> {orderNumber}</Text>}
      {service && <Text style={styles.row}><span style={styles.rowKey}>Service:</span> {service}</Text>}
      {imei && <Text style={styles.row}><span style={styles.rowKey}>IMEI:</span> {imei}</Text>}
      {charged !== undefined && <Text style={styles.row}><span style={styles.rowKey}>Charged:</span> ${charged}</Text>}
      {balance !== undefined && <Text style={styles.row}><span style={styles.rowKey}>Wallet Balance:</span> ${balance}</Text>}
    </div>
    {ctaButton(`${BRAND.url}/dashboard`, 'Track Order')}
    <Text style={styles.small}>You'll be notified by email as soon as your result is ready.</Text>
  </EmailShell>
)

export const template = {
  component: OrderPlacedEmail,
  subject: (d: Record<string, any>) => `🧾 Order #${d.orderNumber ?? ''} received — ${BRAND.name}`,
  displayName: 'Order placed',
  previewData: { name: 'Alex', orderNumber: 'LK-10245', service: 'iPhone iCloud Removal', imei: '356789123456789', charged: 12.5, balance: 47.5 },
} satisfies TemplateEntry
