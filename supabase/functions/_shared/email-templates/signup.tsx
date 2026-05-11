/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Heading, Text } from 'npm:@react-email/components@0.0.22'
import { EmailShell, ctaButton, styles, BRAND } from './_layout.tsx'

interface Props { siteName: string; siteUrl: string; recipient: string; confirmationUrl: string }

export const SignupEmail = ({ recipient, confirmationUrl }: Props) => (
  <EmailShell preview={`Confirm your email for ${BRAND.name}`}>
    <Heading style={styles.h1}>Welcome to {BRAND.name} 🎉</Heading>
    <Text style={styles.text}>
      Thanks for creating your account ({recipient}). You're one click away from unlocking premium IMEI services, instant checks and worldwide support.
    </Text>
    <Text style={styles.text}>Please confirm your email to activate your account:</Text>
    {ctaButton(confirmationUrl, '✓ Verify My Email')}
    <Text style={styles.small}>
      If you didn't create an account, you can safely ignore this email.
    </Text>
  </EmailShell>
)
export default SignupEmail
