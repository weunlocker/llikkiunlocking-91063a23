/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Heading, Text } from 'npm:@react-email/components@0.0.22'
import { EmailShell, styles, BRAND } from './_layout.tsx'

interface ReauthenticationEmailProps { token: string }

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <EmailShell preview={`Your ${BRAND.name} verification code`}>
    <span style={{ ...styles.badge, background: '#E6F7FF', color: '#0066CC' }}>🔢 VERIFICATION CODE</span>
    <Heading style={{ ...styles.h1, marginTop: 12 }}>Verify it's you</Heading>
    <Text style={styles.text}>Use this one-time code to confirm your identity:</Text>
    <div style={{ textAlign: 'center', margin: '8px 0 24px' }}>
      <span style={codeStyle}>{token}</span>
    </div>
    <Text style={styles.small}>This code expires shortly. If you didn't request it, you can safely ignore this email.</Text>
  </EmailShell>
)

export default ReauthenticationEmail

const codeStyle = {
  fontFamily: 'JetBrains Mono, Courier, monospace',
  fontSize: '32px',
  letterSpacing: '8px',
  fontWeight: 700 as const,
  color: BRAND.primaryDark,
  background: '#F0FAFF',
  border: `1px solid ${BRAND.primary}33`,
  padding: '16px 24px',
  borderRadius: '10px',
  display: 'inline-block',
}
