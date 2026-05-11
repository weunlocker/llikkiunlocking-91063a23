/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Heading, Text } from 'npm:@react-email/components@0.0.22'
import { EmailShell, ctaButton, styles, BRAND } from './_layout.tsx'

interface Props { siteName: string; siteUrl: string; confirmationUrl: string }

export const InviteEmail = ({ confirmationUrl }: Props) => (
  <EmailShell preview={`You've been invited to ${BRAND.name}`}>
    <Heading style={styles.h1}>🎯 You're Invited!</Heading>
    <Text style={styles.text}>
      You've been invited to join <strong>{BRAND.name}</strong> — premium IMEI unlocking & checks. Accept your invite to get started.
    </Text>
    {ctaButton(confirmationUrl, 'Accept Invitation')}
    <Text style={styles.small}>
      If you weren't expecting this, you can safely ignore this email.
    </Text>
  </EmailShell>
)
export default InviteEmail
