/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps { token: string }

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your LIKKI UNLOCKING verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}><Text style={brand}>LIKKI UNLOCKING</Text></Section>
        <Section style={card}>
          <Heading style={h1}>Verify it's you</Heading>
          <Text style={text}>Use this code to confirm your identity:</Text>
          <Text style={codeStyle}>{token}</Text>
          <Text style={footer}>This code expires shortly. If you didn't request it, you can safely ignore this email.</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif', margin: 0, padding: 0 }
const container = { maxWidth: '560px', margin: '0 auto', padding: '24px 16px' }
const header = { textAlign: 'center' as const, padding: '8px 0 20px' }
const brand = { fontSize: '14px', fontWeight: 700 as const, letterSpacing: '2px', color: '#00B8FF', margin: 0 }
const card = { background: 'linear-gradient(180deg,#f8fbff 0%,#ffffff 100%)', border: '1px solid #e3eef7', borderRadius: '12px', padding: '32px 28px', textAlign: 'center' as const }
const h1 = { fontSize: '24px', fontWeight: 700 as const, color: '#0a1929', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#475569', lineHeight: '1.6', margin: '0 0 16px' }
const codeStyle = { fontFamily: 'JetBrains Mono, Courier, monospace', fontSize: '32px', letterSpacing: '8px', fontWeight: 700 as const, color: '#00B8FF', background: '#f0faff', padding: '16px 24px', borderRadius: '10px', display: 'inline-block', margin: '0 0 24px' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '20px 0 0' }
