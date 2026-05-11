/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Heading, Text } from 'npm:@react-email/components@0.0.22'
import { EmailShell, ctaButton, styles, BRAND } from '../email-templates/_layout.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { name?: string }

const WelcomeEmail = ({ name }: Props) => (
  <EmailShell preview={`Welcome to ${BRAND.name}`}>
    <Heading style={styles.h1}>👋 Welcome{name ? `, ${name}` : ''}!</Heading>
    <Text style={styles.text}>
      Your {BRAND.name} account is ready. You now have access to premium IMEI unlocking, instant carrier checks, blacklist & FMI status, and 24/7 support.
    </Text>
    <Text style={styles.text}>Get started with your first check or top up your wallet:</Text>
    {ctaButton(BRAND.loginUrl, 'Open Dashboard')}
    <div style={styles.infoBox}>
      <Text style={{ ...styles.row, margin: 0 }}>
        <span style={styles.rowKey}>Tip:</span> Check our pricing for bulk discounts and reseller plans.
      </Text>
    </div>
    <Text style={styles.small}>Need help? Reply to this email — we usually respond within an hour.</Text>
  </EmailShell>
)

export const template = {
  component: WelcomeEmail,
  subject: `Welcome to ${BRAND.name} 🎉`,
  displayName: 'Welcome (new account)',
  previewData: { name: 'Alex' },
} satisfies TemplateEntry
