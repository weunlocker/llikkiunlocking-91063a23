/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Heading, Text } from 'npm:@react-email/components@0.0.22'
import { EmailShell, ctaButton, styles, BRAND } from '../email-templates/_layout.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  name?: string
  subject?: string
  message?: string
}

const SupportReplyEmail = ({ name, subject, message }: Props) => (
  <EmailShell preview={`New support reply${subject ? `: ${subject}` : ''}`}>
    <span style={{ ...styles.badge, background: '#F0F9FF', color: '#0369A1' }}>💬 SUPPORT REPLY</span>
    <Heading style={{ ...styles.h1, marginTop: 12 }}>Hi{name ? ` ${name}` : ''}, support replied</Heading>
    <Text style={styles.text}>You have a new reply from the {BRAND.name} support team.</Text>
    <div style={styles.infoBox}>
      {subject && <Text style={styles.row}><span style={styles.rowKey}>Ticket:</span> {subject}</Text>}
      {message && <Text style={styles.row}><span style={styles.rowKey}>Message:</span> {message}</Text>}
    </div>
    {ctaButton(`${BRAND.url}/dashboard?tab=support`, 'Open Support')}
    <Text style={styles.small}>Please log in to reply or view the full conversation.</Text>
  </EmailShell>
)

export const template = {
  component: SupportReplyEmail,
  subject: (d: Record<string, any>) => `Support replied${d.subject ? `: ${d.subject}` : ''} — ${BRAND.name}`,
  displayName: 'Support reply',
  previewData: { name: 'Alex', subject: 'Order question', message: 'We checked your request and replied with the next step.' },
} satisfies TemplateEntry