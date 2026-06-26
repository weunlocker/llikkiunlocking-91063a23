/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Heading, Text } from 'npm:@react-email/components@0.0.22'
import { EmailShell, ctaButton, styles } from './_layout.tsx'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({ siteName, oldEmail, newEmail, confirmationUrl }: EmailChangeEmailProps) => (
  <EmailShell preview={`Confirm your email change for ${siteName}`}>
    <span style={{ ...styles.badge, background: '#FEF3C7', color: '#92400E' }}>✉️ CONFIRM EMAIL CHANGE</span>
    <Heading style={{ ...styles.h1, marginTop: 12 }}>Confirm your new email</Heading>
    <Text style={styles.text}>
      You requested to change your <strong>{siteName}</strong> account email. Please confirm the change below.
    </Text>
    <div style={styles.infoBox}>
      <Text style={styles.row}><span style={styles.rowKey}>Old email:</span> {oldEmail}</Text>
      <Text style={styles.row}><span style={styles.rowKey}>New email:</span> {newEmail}</Text>
    </div>
    {ctaButton(confirmationUrl, 'Confirm Change')}
    <Text style={styles.small}>If you didn't request this change, please secure your account immediately by resetting your password.</Text>
  </EmailShell>
)

export default EmailChangeEmail
