/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Heading, Text } from 'npm:@react-email/components@0.0.22'
import { EmailShell, ctaButton, styles, BRAND } from './_layout.tsx'

interface Props {
  siteName: string; oldEmail: string; email: string; newEmail: string; confirmationUrl: string
}

export const EmailChangeEmail = ({ oldEmail, newEmail, confirmationUrl }: Props) => (
  <EmailShell preview={`Confirm your email change for ${BRAND.name}`}>
    <Heading style={styles.h1}>📧 Confirm Email Change</Heading>
    <Text style={styles.text}>
      We received a request to change your {BRAND.name} email address from <strong>{oldEmail}</strong> to <strong>{newEmail}</strong>.
    </Text>
    {ctaButton(confirmationUrl, 'Confirm New Email')}
    <Text style={styles.small}>
      If you didn't request this change, please secure your account immediately by resetting your password.
    </Text>
  </EmailShell>
)
export default EmailChangeEmail
