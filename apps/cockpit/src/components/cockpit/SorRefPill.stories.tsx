import type { Meta, StoryObj } from '@storybook/react'
import { SorRefPill } from './SorRefPill'

const meta: Meta<typeof SorRefPill> = {
  title: 'Cockpit/SorRefPill',
  component: SorRefPill,
}
export default meta
type Story = StoryObj<typeof SorRefPill>

export const WithDisplayLabel: Story = {
  args: {
    ref_: {
      sorName: 'Odoo',
      portFamily: 'erp',
      externalId: 'INV-2024-0042',
      externalType: 'invoice',
      displayLabel: 'Invoice #0042',
    },
  },
}

export const WithoutDisplayLabel: Story = {
  args: {
    ref_: {
      sorName: 'SAP',
      portFamily: 'erp',
      externalId: '900123',
      externalType: 'purchase_order',
    },
  },
}

export const WithDeepLink: Story = {
  args: {
    ref_: {
      sorName: 'Odoo',
      portFamily: 'erp',
      externalId: 'INV-2024-0042',
      externalType: 'invoice',
      displayLabel: 'Invoice #0042',
      deepLinkUrl: 'https://example.odoo.com/invoices/42',
    },
  },
}
