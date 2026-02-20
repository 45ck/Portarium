import type { Meta, StoryObj } from '@storybook/react';
import { ChainIntegrityBanner } from '@/components/cockpit/chain-integrity-banner';

const meta: Meta<typeof ChainIntegrityBanner> = {
  title: 'Cockpit/ChainIntegrityBanner',
  component: ChainIntegrityBanner,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof ChainIntegrityBanner>;

export const Verified: Story = { args: { status: 'verified' } };
export const Broken: Story = { args: { status: 'broken' } };
export const Pending: Story = { args: { status: 'pending' } };
