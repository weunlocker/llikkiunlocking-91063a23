/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Hr, Html, Img, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'

export const BRAND = {
  name: 'LIKKIUNLOCKING',
  tagline: 'Premium IMEI Unlocking & Checks',
  url: 'https://likkiunlocking.com',
  loginUrl: 'https://likkiunlocking.com/login',
  supportEmail: 'support@likkiunlocking.com',
  logo: 'https://jhkumqyugvezfulkoine.supabase.co/storage/v1/render/image/public/branding/logo-1777796494624.png?width=168&height=168&quality=80&resize=contain',
  primary: '#00B7FF',
  primaryDark: '#0096D6',
  text: '#0B1220',
  muted: '#6B7280',
}

export const EmailShell: React.FC<{ preview: string; children: React.ReactNode }> = ({ preview, children }) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{preview}</Preview>
    <Body style={main}>
      <Container style={outer}>
        {/* Header */}
        <Section style={headerBar}>
          <Img src={BRAND.logo} alt={BRAND.name} width="56" height="56" style={logoImg} />
          <Text style={brandName}>{BRAND.name}</Text>
          <Text style={brandTag}>{BRAND.tagline}</Text>
        </Section>

        {/* Card */}
        <Container style={card}>{children}</Container>

        {/* Footer */}
        <Section style={footerWrap}>
          <Hr style={hr} />
          <Text style={footerText}>
            Need help? <Link href={`mailto:${BRAND.supportEmail}`} style={footerLink}>{BRAND.supportEmail}</Link>
          </Text>
          <Text style={footerText}>
            <Link href={BRAND.loginUrl} style={footerLink}>Login</Link>
            {' · '}
            <Link href={BRAND.url} style={footerLink}>Website</Link>
            {' · '}
            <Link href={`${BRAND.url}/pricing`} style={footerLink}>Pricing</Link>
          </Text>
          <Text style={footerSmall}>
            © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const ctaButton = (href: string, label: string) => (
  <table cellPadding={0} cellSpacing={0} role="presentation" style={{ margin: '8px 0 24px' }}>
    <tbody><tr><td style={btnTd}>
      <a href={href} style={btnLink}>{label}</a>
    </td></tr></tbody>
  </table>
)

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif', margin: 0, padding: 0 }
const outer = { width: '100%', maxWidth: '600px', margin: '0 auto', padding: '24px 12px' }
const headerBar = {
  background: 'linear-gradient(135deg, #00B7FF 0%, #0066CC 100%)',
  borderRadius: '16px 16px 0 0',
  padding: '28px 24px',
  textAlign: 'center' as const,
}
const logoImg = { display: 'block', margin: '0 auto 8px', borderRadius: '12px', background: '#ffffff', padding: '6px' }
const brandName = { color: '#ffffff', fontSize: '22px', fontWeight: 800 as const, letterSpacing: '1px', margin: '6px 0 2px' }
const brandTag = { color: 'rgba(255,255,255,0.9)', fontSize: '12px', margin: 0, fontWeight: 500 as const }
const card = {
  background: '#ffffff',
  border: '1px solid #E5EAF0',
  borderTop: 'none',
  borderRadius: '0 0 16px 16px',
  padding: '32px 28px',
}
const footerWrap = { padding: '20px 12px 8px', textAlign: 'center' as const }
const hr = { borderColor: '#E5EAF0', margin: '0 0 16px' }
const footerText = { fontSize: '12px', color: '#6B7280', margin: '4px 0' }
const footerLink = { color: '#0096D6', textDecoration: 'none', fontWeight: 600 as const }
const footerSmall = { fontSize: '11px', color: '#9CA3AF', margin: '12px 0 0' }
const btnTd = {
  background: 'linear-gradient(135deg, #00B7FF 0%, #0066CC 100%)',
  borderRadius: '10px',
  boxShadow: '0 4px 14px rgba(0,150,214,0.35)',
}
const btnLink = {
  display: 'inline-block',
  padding: '14px 28px',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 700 as const,
  textDecoration: 'none',
  letterSpacing: '0.3px',
}

export const styles = {
  h1: { fontSize: '22px', fontWeight: 800 as const, color: BRAND.text, margin: '0 0 12px' },
  text: { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' },
  small: { fontSize: '12px', color: BRAND.muted, lineHeight: '1.5', margin: '20px 0 0' },
  link: { color: BRAND.primaryDark, textDecoration: 'underline' },
  badge: { display: 'inline-block', background: '#E6F7FF', color: '#0066CC', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700 as const },
  infoBox: { background: '#F8FAFC', border: '1px solid #E5EAF0', borderRadius: '10px', padding: '14px 16px', margin: '0 0 18px' },
  row: { fontSize: '13px', color: '#374151', margin: '4px 0' },
  rowKey: { color: '#6B7280', fontWeight: 600 as const },
}
