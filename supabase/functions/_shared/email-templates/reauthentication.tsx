/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Heading, Text } from 'npm:@react-email/components@0.0.22'
import { EmailShell, styles, BRAND } from './_layout.tsx'

interface Props { token: string }

export const ReauthenticationEmail = ({ token }: Props) => (
  <EmailShell preview="Your verification code">
    <Heading style={styles.h1}>🔐 Verification Code</Heading>
    <Text style={styles.text}>Use the code below to confirm your identity on {BRAND.name}:</Text>
    <div style={{
      fontFamily: 'JetBrains Mono, Courier, monospace',
      fontSize: '34px', fontWeight: 800, letterSpacing: '10px',
      color: '#0066CC', background: '#E6F7FF', textAlign: 'center',
      padding: '18px 12px', borderRadius: '12px', margin: '8px 0 24px',
    }}>{token}</div>
    <Text style={styles.small}>
      This code will expire shortly. If you didn't request this, please ignore this email.
    </Text>
  </EmailShell>
)
export default ReauthenticationEmail
