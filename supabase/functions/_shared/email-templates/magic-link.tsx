/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Heading, Text } from 'npm:@react-email/components@0.0.22'
import { EmailShell, ctaButton, styles, BRAND } from './_layout.tsx'

interface Props { siteName: string; confirmationUrl: string }

export const MagicLinkEmail = ({ confirmationUrl }: Props) => (
  <EmailShell preview={`Your login link for ${BRAND.name}`}>
    <Heading style={styles.h1}>✨ Your Login Link</Heading>
    <Text style={styles.text}>
      Click the button below to sign in to your {BRAND.name} account. This link expires shortly.
    </Text>
    {ctaButton(confirmationUrl, 'Log In Securely')}
    <Text style={styles.small}>
      If you didn't request this, you can safely ignore this email.
    </Text>
  </EmailShell>
)
export default MagicLinkEmail
