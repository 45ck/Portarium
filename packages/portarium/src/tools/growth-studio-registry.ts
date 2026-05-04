// cspell:ignore typebox
import { Type, type TSchema } from '@sinclair/typebox';

export type GrowthStudioToolRiskCategory = 'ReadOnly' | 'Mutation' | 'Dangerous';
export type GrowthStudioToolClassificationTier = 'Auto' | 'HumanApprove' | 'ManualOnly';

export type GrowthStudioToolDefinition = Readonly<{
  name: string;
  description: string;
  inputSchema: TSchema;
  classification: Readonly<{
    category: GrowthStudioToolRiskCategory;
    minimumTier: GrowthStudioToolClassificationTier;
  }>;
}>;

const PublicUrl = Type.String({
  format: 'uri',
  description: 'Public URL used as source evidence for the Growth Studio run.',
});

const ProspectId = Type.String({
  minLength: 1,
  description: 'Stable prospect identifier from the Growth Studio run.',
});

const CampaignId = Type.String({
  minLength: 1,
  description: 'Stable campaign identifier for the Growth Studio run.',
});

const DraftId = Type.String({
  minLength: 1,
  description: 'Approved draft identifier from the Growth Studio approval packet.',
});

const ApprovalId = Type.String({
  minLength: 1,
  description: 'Portarium Approval Gate identifier authorizing the requested Action.',
});

const EvidenceArtifactIds = Type.Array(Type.String({ minLength: 1 }), {
  description: 'Evidence Artifacts supporting the requested Action.',
});

export const GROWTH_STUDIO_TOOL_REGISTRY: readonly GrowthStudioToolDefinition[] = [
  {
    name: 'web-search',
    description: 'Search Google or Bing for public prospect information.',
    inputSchema: Type.Object(
      {
        query: Type.String({ minLength: 1 }),
        maxResults: Type.Optional(Type.Integer({ minimum: 1, maximum: 25 })),
      },
      { additionalProperties: false },
    ),
    classification: { category: 'ReadOnly', minimumTier: 'Auto' },
  },
  {
    name: 'scrape-website',
    description: 'Extract text from a public URL for citation-backed prospect research.',
    inputSchema: Type.Object(
      {
        url: PublicUrl,
        evidenceArtifactIds: Type.Optional(EvidenceArtifactIds),
      },
      { additionalProperties: false },
    ),
    classification: { category: 'ReadOnly', minimumTier: 'Auto' },
  },
  {
    name: 'read-crm-contact',
    description: 'Fetch an existing CRM contact record without changing CRM state.',
    inputSchema: Type.Object(
      {
        contactId: ProspectId,
      },
      { additionalProperties: false },
    ),
    classification: { category: 'ReadOnly', minimumTier: 'Auto' },
  },
  {
    name: 'read-analytics',
    description: 'Fetch campaign metrics for the Growth Studio measurement stage.',
    inputSchema: Type.Object(
      {
        campaignId: CampaignId,
        metricNames: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
      },
      { additionalProperties: false },
    ),
    classification: { category: 'ReadOnly', minimumTier: 'Auto' },
  },
  {
    name: 'draft-email',
    description: 'Compose an outreach email draft without sending it.',
    inputSchema: Type.Object(
      {
        prospectId: ProspectId,
        contentBriefId: Type.String({ minLength: 1 }),
        evidenceArtifactIds: EvidenceArtifactIds,
      },
      { additionalProperties: false },
    ),
    classification: { category: 'Mutation', minimumTier: 'HumanApprove' },
  },
  {
    name: 'draft-linkedin-post',
    description: 'Compose a LinkedIn post draft without publishing it.',
    inputSchema: Type.Object(
      {
        campaignId: CampaignId,
        contentBriefId: Type.String({ minLength: 1 }),
        evidenceArtifactIds: EvidenceArtifactIds,
      },
      { additionalProperties: false },
    ),
    classification: { category: 'Mutation', minimumTier: 'HumanApprove' },
  },
  {
    name: 'draft-blog-article',
    description: 'Generate a blog article draft without publishing it.',
    inputSchema: Type.Object(
      {
        campaignId: CampaignId,
        contentBriefId: Type.String({ minLength: 1 }),
        evidenceArtifactIds: EvidenceArtifactIds,
      },
      { additionalProperties: false },
    ),
    classification: { category: 'Mutation', minimumTier: 'HumanApprove' },
  },
  {
    name: 'update-crm-contact',
    description: 'Update approved CRM contact fields or notes.',
    inputSchema: Type.Object(
      {
        contactId: ProspectId,
        approvalId: ApprovalId,
        fields: Type.Record(Type.String({ minLength: 1 }), Type.Unknown()),
      },
      { additionalProperties: false },
    ),
    classification: { category: 'Mutation', minimumTier: 'HumanApprove' },
  },
  {
    name: 'schedule-content',
    description: 'Add approved draft content to a publishing queue.',
    inputSchema: Type.Object(
      {
        draftId: DraftId,
        approvalId: ApprovalId,
        scheduledAt: Type.String({ format: 'date-time' }),
      },
      { additionalProperties: false },
    ),
    classification: { category: 'Mutation', minimumTier: 'HumanApprove' },
  },
  {
    name: 'send-email',
    description: 'Send an approved email to an external recipient.',
    inputSchema: Type.Object(
      {
        draftId: DraftId,
        approvalId: ApprovalId,
        recipientEmail: Type.String({ format: 'email' }),
      },
      { additionalProperties: false },
    ),
    classification: { category: 'Dangerous', minimumTier: 'ManualOnly' },
  },
  {
    name: 'publish-linkedin-post',
    description: 'Publish an approved LinkedIn post to a live account.',
    inputSchema: Type.Object(
      {
        draftId: DraftId,
        approvalId: ApprovalId,
        accountId: Type.String({ minLength: 1 }),
      },
      { additionalProperties: false },
    ),
    classification: { category: 'Dangerous', minimumTier: 'ManualOnly' },
  },
  {
    name: 'publish-blog-article',
    description: 'Publish an approved article to a live site.',
    inputSchema: Type.Object(
      {
        draftId: DraftId,
        approvalId: ApprovalId,
        siteId: Type.String({ minLength: 1 }),
        slug: Type.String({ minLength: 1 }),
      },
      { additionalProperties: false },
    ),
    classification: { category: 'Dangerous', minimumTier: 'ManualOnly' },
  },
  {
    name: 'delete-crm-contact',
    description: 'Remove a CRM contact record after explicit manual operator action.',
    inputSchema: Type.Object(
      {
        contactId: ProspectId,
        approvalId: ApprovalId,
        deletionReason: Type.String({ minLength: 1 }),
      },
      { additionalProperties: false },
    ),
    classification: { category: 'Dangerous', minimumTier: 'ManualOnly' },
  },
];
