/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Heading, Text } from 'npm:@react-email/components@0.0.22'
import { EmailShell, ctaButton, styles, BRAND } from './_layout.tsx'

interface RecoveryEmailProps { siteName: string; confirmationUrl: string }

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <EmailShell preview={`Reset your ${siteName} password`}>
    <span style={{ ...styles.badge, background: '#FEF3C7', color: '#92400E' }}>🔐 PASSWORD RESET</span>
    <Heading style={{ ...styles.h1, marginTop: 12 }}>Reset your password</Heading>
    <Text style={styles.text}>
      We received a request to reset your password for <strong>{siteName}</strong>. Click the button below to choose a new one. This link expires shortly for your security.
    </Text>
    {ctaButton(confirmationUrl, 'Reset Password')}
    <div style={styles.infoBox}>
      <Text style={{ ...styles.row, margin: 0 }}>
        <span style={styles.rowKey}>Security tip:</span> Never share this link with anyone. {siteName} staff will never ask for your password.
      </Text>
    </div>
    <Text style={styles.small}>Didn't request this? You can safely ignore this email — your password won't change.</Text>
  </EmailShell>
)

export default RecoveryEmail
