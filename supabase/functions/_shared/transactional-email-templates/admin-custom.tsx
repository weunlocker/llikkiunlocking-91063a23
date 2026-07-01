/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Heading, Text } from 'npm:@react-email/components@0.0.22'
import { EmailShell, ctaButton, styles, BRAND } from '../email-templates/_layout.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  name?: string
  email?: string
  heading?: string
  body?: string
  ctaLabel?: string
  ctaUrl?: string
}

const renderBody = (body?: string, name?: string, email?: string) => {
  const text = (body ?? '')
    .replace(/\{\{\s*name\s*\}\}/gi, name ?? '')
    .replace(/\{\{\s*email\s*\}\}/gi, email ?? '')
  return text.split(/\n{2,}/).map((para, i) => (
    <Text key={i} style={styles.text}>
      {para.split('\n').map((line, j, arr) => (
        <React.Fragment key={j}>{line}{j < arr.length - 1 ? <br /> : null}</React.Fragment>
      ))}
    </Text>
  ))
}

const AdminCustomEmail = ({ name, email, heading, body, ctaLabel, ctaUrl }: Props) => (
  <EmailShell preview={heading || `A message from ${BRAND.name}`}>
    <Heading style={styles.h1}>{heading || `Hi${name ? ` ${name}` : ''} 👋`}</Heading>
    {renderBody(body, name, email)}
    {ctaUrl ? ctaButton(ctaUrl, ctaLabel || 'Open Dashboard') : ctaButton(`${BRAND.url}/dashboard`, 'Open Dashboard')}
    <Text style={styles.small}>Need help? Just reply to this email — we're happy to help.</Text>
  </EmailShell>
)

export const template = {
  component: AdminCustomEmail,
  subject: (d: Record<string, any>) => d.subject || `A message from ${BRAND.name}`,
  displayName: 'Admin custom message',
  previewData: {
    name: 'Alex',
    email: 'alex@example.com',
    heading: 'Welcome to LikkiUnlocking 🎉',
    body: 'Hi {{name}},\n\nThanks for joining us! Your account ({{email}}) is ready to use.\n\nHave a great day.',
    ctaLabel: 'Open Dashboard',
  },
} satisfies TemplateEntry
