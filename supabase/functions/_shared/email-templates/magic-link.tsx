/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Heading, Text, Section } from 'npm:@react-email/components@0.0.22'
import { EmailShell, ctaButton, styles } from './_layout.tsx'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl?: string
  token?: string
}

export const MagicLinkEmail = ({ siteName, confirmationUrl, token }: MagicLinkEmailProps) => (
  <EmailShell preview={`Your login code for ${siteName}`}>
    <span style={{ ...styles.badge, background: '#E6F7FF', color: '#0066CC' }}>🔑 SECURE LOGIN</span>
    <Heading style={{ ...styles.h1, marginTop: 12 }}>Your login code</Heading>
    <Text style={styles.text}>
      Use the 6-digit code below to finish signing in to <strong>{siteName}</strong>. This code expires shortly and can only be used once.
    </Text>
    {token ? (
      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <div
          style={{
            display: 'inline-block',
            padding: '18px 32px',
            background: '#F3F8FF',
            border: '2px dashed #0066CC',
            borderRadius: 12,
            fontSize: 34,
            letterSpacing: 10,
            fontWeight: 700,
            color: '#0066CC',
            fontFamily: 'monospace',
          }}
        >
          {token}
        </div>
      </Section>
    ) : null}
    {confirmationUrl ? (
      <>
        <Text style={{ ...styles.small, textAlign: 'center', margin: '12px 0' }}>
          Or click the button below to sign in instantly:
        </Text>
        {ctaButton(confirmationUrl, 'Log In Now')}
      </>
    ) : null}
    <Text style={styles.small}>If you didn't request this, you can safely ignore this email.</Text>
  </EmailShell>
)

export default MagicLinkEmail
