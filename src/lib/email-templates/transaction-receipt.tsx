import React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  name?: string
  kind?: 'collection' | 'payout'
  amount?: string
  reference?: string
  phone?: string
  description?: string
  date?: string
  merchant?: string
  forAdmin?: boolean
}

const Row = ({ label, value }: { label: string; value?: string }) =>
  value ? (
    <Text style={row}>
      <span style={muted}>{label}</span>
      <br />
      <strong>{value}</strong>
    </Text>
  ) : null

const Email = ({ name, kind = 'collection', amount = 'UGX 0', reference, phone, description, date, merchant, forAdmin }: Props) => {
  const isPayout = kind === 'payout'
  const heading = isPayout ? 'Payout sent successfully' : 'Payment received'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`${heading} — ${amount}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>ObPay</Text>
          <Heading style={h1}>{heading}</Heading>
          <Text style={text}>
            {forAdmin
              ? `A ${isPayout ? 'payout' : 'collection'} of ${amount} completed for merchant ${merchant || 'unknown'}.`
              : `${name ? `Hi ${name},` : 'Hello,'} your ${isPayout ? 'payout' : 'collection'} of ${amount} completed successfully.`}
          </Text>
          <Section style={box}>
            <Row label="Amount" value={amount} />
            <Row label="Reference" value={reference} />
            <Row label="Phone" value={phone} />
            <Row label="Description" value={description} />
            <Row label="Date" value={date} />
          </Section>
          <Hr style={hr} />
          <Text style={small}>
            {forAdmin ? 'ObPay admin alert.' : 'You can view this transaction any time in your ObPay dashboard. Support: +256762201984'}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `${d['forAdmin'] ? '[ObPay] ' : ''}${d['kind'] === 'payout' ? 'Payout sent' : 'Payment received'} — ${d['amount'] || ''}`,
  displayName: 'Transaction receipt',
  previewData: { name: 'Jane Traders', kind: 'collection', amount: 'UGX 50,000', reference: 'OBP123456', phone: '256772123456', date: '26 Sep 2026, 15:40' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '28px 24px', maxWidth: '520px' }
const brand = { fontSize: '18px', fontWeight: 700, color: '#0f766e', margin: '0 0 16px' }
const h1 = { fontSize: '22px', color: '#111827', margin: '0 0 12px' }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.6' }
const box = { backgroundColor: '#f3f4f6', borderRadius: '10px', padding: '8px 16px', margin: '16px 0' }
const row = { fontSize: '13px', color: '#111827', margin: '8px 0' }
const muted = { color: '#6b7280', fontSize: '12px' }
const hr = { borderColor: '#e5e7eb', margin: '20px 0' }
const small = { fontSize: '12px', color: '#6b7280' }
