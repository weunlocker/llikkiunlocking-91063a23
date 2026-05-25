/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps { siteName: string; confirmationUrl: string }

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your secure login link for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}><Text style={brand}>LIKKI UNLOCKING</Text></Section>
        <Section style={card}>
          <Heading style={h1}>Your login link</Heading>
          <Text style={text}>Click below to log in to {siteName}. This link expires shortly for your security.</Text>
          <Button style={button} href={confirmationUrl}>Log In</Button>
          <Text style={footer}>If you didn't request this link, you can safely ignore this email.</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif', margin: 0, padding: 0 }
const container = { maxWidth: '560px', margin: '0 auto', padding: '24px 16px' }
const header = { textAlign: 'center' as const, padding: '8px 0 20px' }
const brand = { fontSize: '14px', fontWeight: 700 as const, letterSpacing: '2px', color: '#00B8FF', margin: 0 }
const card = { background: 'linear-gradient(180deg,#f8fbff 0%,#ffffff 100%)', border: '1px solid #e3eef7', borderRadius: '12px', padding: '32px 28px' }
const h1 = { fontSize: '24px', fontWeight: 700 as const, color: '#0a1929', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#475569', lineHeight: '1.6', margin: '0 0 24px' }
const button = { background: 'linear-gradient(135deg,#00B8FF,#4FD1FF)', color: '#ffffff', fontSize: '15px', fontWeight: 600 as const, borderRadius: '10px', padding: '14px 28px', textDecoration: 'none', display: 'inline-block' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '28px 0 0' }
