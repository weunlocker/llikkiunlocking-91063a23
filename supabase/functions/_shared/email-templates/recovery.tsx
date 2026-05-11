/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Heading, Text } from 'npm:@react-email/components@0.0.22'
import { EmailShell, ctaButton, styles, BRAND } from './_layout.tsx'

interface Props { siteName: string; confirmationUrl: string }

export const RecoveryEmail = ({ confirmationUrl }: Props) => (
  <EmailShell preview={`Reset your password for ${BRAND.name}`}>
    <Heading style={styles.h1}>🔒 Reset Your Password</Heading>
    <Text style={styles.text}>
      We received a request to reset the password for your {BRAND.name} account. Click the button below to choose a new password — the link expires shortly for your security.
    </Text>
    {ctaButton(confirmationUrl, 'Reset Password')}
    <Text style={styles.small}>
      Didn't request this? You can safely ignore this email — your password won't change.
    </Text>
  </EmailShell>
)
export default RecoveryEmail
