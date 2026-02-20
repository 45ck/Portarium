import type { Meta, StoryObj } from '@storybook/react';
import { EvidenceCategoryBadge } from '@/components/cockpit/evidence-category-badge';

const meta: Meta<typeof EvidenceCategoryBadge> = {
  title: 'Cockpit/EvidenceCategoryBadge',
  component: EvidenceCategoryBadge,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof EvidenceCategoryBadge>;

export const Plan: Story = { args: { category: 'Plan' } };
export const Action: Story = { args: { category: 'Action' } };
export const Approval: Story = { args: { category: 'Approval' } };
export const Policy: Story = { args: { category: 'Policy' } };
export const System: Story = { args: { category: 'System' } };
