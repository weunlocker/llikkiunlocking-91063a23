/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Heading, Text } from 'npm:@react-email/components@0.0.22'
import { EmailShell, styles, BRAND } from './_layout.tsx'

interface Props { siteName: string; confirmationUrl: string; token?: string }

export const MagicLinkEmail = ({ token }: Props) => (
  <EmailShell preview={`Your login code for ${BRAND.name}`}>
    <Heading style={styles.h1}>🔐 Your Login Code</Heading>
    <Text style={styles.text}>
      Use the code below to sign in to your {BRAND.name} account. This code expires shortly.
    </Text>
    <div style={{
      fontFamily: 'JetBrains Mono, Courier, monospace',
      fontSize: '32px', fontWeight: 800, letterSpacing: '8px',
      color: '#0066CC', background: '#E6F7FF', textAlign: 'center',
      padding: '18px 12px', borderRadius: '12px', margin: '8px 0 24px',
    }}>{token ?? '--------'}</div>
    <Text style={styles.small}>
      If you didn't request this, you can safely ignore this email.
    </Text>
  </EmailShell>
)
export default MagicLinkEmail
