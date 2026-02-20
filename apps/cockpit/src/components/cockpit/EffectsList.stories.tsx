import type { Meta, StoryObj } from '@storybook/react'
import { EffectsList } from './EffectsList'
import type { PlanEffect, PredictedPlanEffect } from '@portarium/cockpit-types'

const meta: Meta<typeof EffectsList> = {
  title: 'Cockpit/EffectsList',
  component: EffectsList,
}
export default meta
type Story = StoryObj<typeof EffectsList>

const target = {
  sorName: 'Odoo',
  portFamily: 'erp',
  externalId: 'INV-2024-0042',
  externalType: 'invoice',
  displayLabel: 'Invoice #0042',
}

const planned: PlanEffect[] = [
  { effectId: 'e1', operation: 'Update', target, summary: 'Correct line amount from 250 to 225' },
  { effectId: 'e2', operation: 'Create', target: { ...target, externalId: 'CN-001', displayLabel: 'Credit Note #001' }, summary: 'Issue credit note for difference' },
]

const predicted: PredictedPlanEffect[] = [
  { effectId: 'e3', operation: 'Update', target: { ...target, externalId: 'PO-4421', externalType: 'purchase_order', displayLabel: 'PO #4421' }, summary: 'Update PO status to reconciled', confidence: 0.85 },
]

const verified: PlanEffect[] = [
  { effectId: 'e1', operation: 'Update', target, summary: 'Correct line amount from 250 to 225' },
]

export const WithAllThree: Story = {
  args: { planned, predicted, verified },
}

export const PlannedOnly: Story = {
  args: { planned },
}

export const Empty: Story = {
  args: { planned: [], predicted: [], verified: [] },
}
