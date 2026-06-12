/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Heading, Text } from 'npm:@react-email/components@0.0.22'
import { EmailShell, ctaButton, styles, BRAND } from '../email-templates/_layout.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  name?: string
  kind?: 'new' | 'price'
  serviceName?: string
  oldPrice?: string | number
  newPrice?: string | number
  serviceUrl?: string
}

const ServiceUpdateEmail = ({ name, kind, serviceName, oldPrice, newPrice, serviceUrl }: Props) => {
  const isNew = kind === 'new'
  const decreased = !isNew && oldPrice !== undefined && newPrice !== undefined && Number(newPrice) < Number(oldPrice)
  const badgeColor = isNew ? '#E6F7E6' : decreased ? '#E6F7E6' : '#FFF4E5'
  const badgeText = isNew ? '🆕 NEW SERVICE' : decreased ? '📉 PRICE DROPPED' : '📈 PRICE UPDATED'
  const heading = isNew
    ? `New service available: ${serviceName ?? ''}`
    : `Price ${decreased ? 'decreased' : 'updated'} for ${serviceName ?? 'a service'}`
  return (
    <EmailShell preview={heading}>
      <span style={{ ...styles.badge, background: badgeColor, color: '#0a6b22' }}>{badgeText}</span>
      <Heading style={{ ...styles.h1, marginTop: 12 }}>Hi{name ? ` ${name}` : ''}, {heading}</Heading>
      <Text style={styles.text}>
        {isNew
          ? `We've added a new service on ${BRAND.name}. Check it out below.`
          : `The price for this ${BRAND.name} service has changed. Here are the latest details.`}
      </Text>
      <div style={styles.infoBox}>
        {serviceName && <Text style={styles.row}><span style={styles.rowKey}>Service:</span> {serviceName}</Text>}
        {!isNew && oldPrice !== undefined && <Text style={styles.row}><span style={styles.rowKey}>Old price:</span> {Number(oldPrice).toFixed(2)} USD</Text>}
        {newPrice !== undefined && <Text style={styles.row}><span style={styles.rowKey}>{isNew ? 'Price' : 'New price'}:</span> {Number(newPrice).toFixed(2)} USD</Text>}
      </div>
      {ctaButton(serviceUrl || `${BRAND.url}/services`, 'View Service')}
      <Text style={styles.small}>You can disable these notifications in your profile email preferences.</Text>
    </EmailShell>
  )
}

export const template = {
  component: ServiceUpdateEmail,
  subject: (d: Record<string, any>) => {
    if (d.kind === 'new') return `🆕 New service: ${d.serviceName ?? ''}`
    const dec = d.oldPrice !== undefined && d.newPrice !== undefined && Number(d.newPrice) < Number(d.oldPrice)
    return `${dec ? '📉 Price decreased' : '📈 Price updated'}: ${d.serviceName ?? ''}`
  },
  displayName: 'Service update',
  previewData: { name: 'Alex', kind: 'price', serviceName: 'iPhone Unlock', oldPrice: 20.19, newPrice: 18.69 },
} satisfies TemplateEntry
