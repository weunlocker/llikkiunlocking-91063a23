/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Heading, Text, Link } from 'npm:@react-email/components@0.0.22'
import { EmailShell, ctaButton, styles, BRAND } from './_layout.tsx'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ siteName, siteUrl, recipient, confirmationUrl }: SignupEmailProps) => (
  <EmailShell preview={`Confirm your email to start unlocking with ${siteName}`}>
    <span style={{ ...styles.badge, background: '#DCFCE7', color: '#15803D' }}>✓ VERIFY YOUR EMAIL</span>
    <Heading style={{ ...styles.h1, marginTop: 12 }}>Welcome aboard 🚀</Heading>
    <Text style={styles.text}>
      Thanks for signing up for <Link href={siteUrl} style={styles.link}><strong>{siteName}</strong></Link>.
      Please confirm <strong>{recipient}</strong> to activate your account and start unlocking devices.
    </Text>
    {ctaButton(confirmationUrl, 'Verify Email')}
    <div style={styles.infoBox}>
      <Text style={{ ...styles.row, margin: 0 }}>
        <span style={styles.rowKey}>Tip:</span> After verifying you'll get instant access to IMEI checks, unlocking & 24/7 support.
      </Text>
    </div>
    <Text style={styles.small}>If you didn't create an account, you can safely ignore this email — no account will be created.</Text>
  </EmailShell>
)

export default SignupEmail
