/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Heading, Text } from 'npm:@react-email/components@0.0.22'
import { EmailShell, ctaButton, styles } from './_layout.tsx'

interface MagicLinkEmailProps { siteName: string; confirmationUrl: string }

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <EmailShell preview={`Your secure login link for ${siteName}`}>
    <span style={{ ...styles.badge, background: '#E6F7FF', color: '#0066CC' }}>🔑 SECURE LOGIN</span>
    <Heading style={{ ...styles.h1, marginTop: 12 }}>Your login link</Heading>
    <Text style={styles.text}>
      Click the button below to log in to <strong>{siteName}</strong>. This link expires shortly for your security and can only be used once.
    </Text>
    {ctaButton(confirmationUrl, 'Log In Now')}
    <Text style={styles.small}>If you didn't request this link, you can safely ignore this email.</Text>
  </EmailShell>
)

export default MagicLinkEmail
