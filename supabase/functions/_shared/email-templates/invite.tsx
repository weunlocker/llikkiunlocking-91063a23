/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Heading, Text, Link } from 'npm:@react-email/components@0.0.22'
import { EmailShell, ctaButton, styles } from './_layout.tsx'

interface InviteEmailProps { siteName: string; siteUrl: string; confirmationUrl: string }

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <EmailShell preview={`You're invited to join ${siteName}`}>
    <span style={{ ...styles.badge, background: '#F3E8FF', color: '#6B21A8' }}>🎉 YOU'RE INVITED</span>
    <Heading style={{ ...styles.h1, marginTop: 12 }}>You've been invited</Heading>
    <Text style={styles.text}>
      Join <Link href={siteUrl} style={styles.link}><strong>{siteName}</strong></Link> — accept your invitation and create your account in seconds.
    </Text>
    {ctaButton(confirmationUrl, 'Accept Invitation')}
    <Text style={styles.small}>Not expecting this? You can safely ignore this email.</Text>
  </EmailShell>
)

export default InviteEmail
