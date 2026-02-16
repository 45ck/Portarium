# Port 12: Ads Platforms — Integration Catalog

## Port Operations

| Operation          | Description                                                              | Idempotent |
| ------------------ | ------------------------------------------------------------------------ | ---------- |
| `listCampaigns`    | List advertising campaigns with filter by status, objective, and date    | Yes        |
| `getCampaign`      | Retrieve a single campaign with settings, budget, and targeting          | Yes        |
| `createCampaign`   | Create a new campaign with objective, budget, schedule, and targeting    | No         |
| `updateCampaign`   | Update campaign settings (name, budget, schedule, targeting, status)     | No         |
| `pauseCampaign`    | Pause a running campaign (sets status to paused)                         | No         |
| `listAdGroups`     | List ad groups/ad sets within a campaign                                 | Yes        |
| `getAdGroup`       | Retrieve a single ad group with targeting and bid settings               | Yes        |
| `createAdGroup`    | Create a new ad group within a campaign                                  | No         |
| `listAds`          | List individual ads within an ad group                                   | Yes        |
| `getAd`            | Retrieve a single ad with creative, targeting, and status                | Yes        |
| `createAd`         | Create a new ad with creative content and targeting parameters           | No         |
| `getCampaignStats` | Retrieve performance metrics for a campaign (impressions, clicks, spend) | Yes        |
| `getAdGroupStats`  | Retrieve performance metrics for an ad group                             | Yes        |
| `getAdStats`       | Retrieve performance metrics for an individual ad                        | Yes        |
| `listAudiences`    | List audiences (custom, lookalike, remarketing) available for targeting  | Yes        |
| `createAudience`   | Create a new custom or lookalike audience from a source                  | No         |
| `getBudget`        | Retrieve budget details and spend pacing for a campaign                  | Yes        |
| `updateBudget`     | Update campaign budget amount, type (daily/lifetime), or pacing          | No         |
| `listKeywords`     | List keywords within a search ad group with bids and match types         | Yes        |

---

## Provider Catalog

### Tier A1 — Must-Support Providers (>30 % market share or >50 k customers)

| Provider                            | Source                                                                                         | Adoption | Est. Customers                                                                   | API Style                              | Webhooks                                                                                                      | Key Entities                                                                                                                                                                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Google Ads**                      | S1 — Google Ads API (v17+) with full REST/gRPC, OAuth 2.0, test accounts and sandbox MCC       | A1       | ~80 % of global search ad market; millions of active advertisers                 | REST / gRPC (protobuf), OAuth 2.0      | No real-time webhooks — change history and reporting via polling; Google Ads scripts for event-driven actions | Campaign, AdGroup, Ad, Keyword, BiddingStrategy, Budget, Audience (UserList, CombinedAudience), ConversionAction, Label, Extension (Sitelink, Callout, StructuredSnippet), Asset (Image, Video, Text), GeoTarget, Report/Metrics |
| **Meta Ads** (Facebook / Instagram) | S1 — Marketing API via Graph API with versioned endpoints, sandbox ad accounts, extensive docs | A1       | ~10 M+ active advertisers; ~$130 B annual ad revenue; dominant in social display | Graph API (REST-like, JSON), OAuth 2.0 | Yes — webhooks via Meta Webhooks (leads, ad account changes, page events)                                     | Campaign, AdSet, Ad, Creative (AdCreative), Audience (CustomAudience, LookalikeAudience), Pixel, Conversion (OfflineConversion), Targeting (detailed targeting specs), AdAccount, InsightReport, Placement                       |

### Tier A2 — Strong Contenders (10–30 % share or >10 k customers)

| Provider                             | Source                                                                                                                | Adoption | Est. Customers                                                                                    | API Style                                 | Webhooks                                                                           | Key Entities                                                                                                                                                                                                                                                |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **LinkedIn Ads** (Microsoft)         | S1 — LinkedIn Marketing API with REST endpoints, OAuth 2.0, developer sandbox                                         | A2       | ~58 M+ companies on LinkedIn; primary B2B advertising platform                                    | REST (JSON), OAuth 2.0                    | No real-time webhooks — conversion tracking via Insight Tag; reporting via polling | Campaign, CampaignGroup, Creative, Audience (MatchedAudience, PredictiveAudience), ConversionTracking (Insight Tag), Account (AdAccount), Analytics, Share (sponsored content), InMailMessage (Message Ads)                                                 |
| **TikTok Ads** (ByteDance)           | S1 — TikTok Marketing API with REST endpoints, sandbox mode, comprehensive docs                                       | A2       | Fastest-growing ads platform; ~$20 B annual ad revenue; strong with Gen Z/Millennial demographics | REST (JSON), OAuth 2.0 or App ID + Secret | Yes — webhooks for ad review status and report completion                          | Campaign, AdGroup, Ad, Audience (CustomAudience, LookalikeAudience), Pixel (TikTok Pixel), Creative (Video, Image, Spark Ads), Reporting (async reports), Identity (brand/custom), Image, Video                                                             |
| **Amazon Ads**                       | S1 — Amazon Advertising API (v3) with REST endpoints, OAuth 2.0 (Login with Amazon), sandbox profiles                 | A2       | ~$47 B annual ad revenue; dominant in retail media / product advertising                          | REST (JSON), OAuth 2.0                    | No real-time webhooks — async reporting with status polling                        | Campaign, AdGroup, Ad (SponsoredProduct, SponsoredBrand, SponsoredDisplay), Keyword, Targeting (product/audience targeting), Budget, Report (async download), Portfolio, NegativeKeyword                                                                    |
| **Microsoft Advertising** (Bing Ads) | S1 — Bing Ads API with REST and SOAP endpoints, OAuth 2.0, sandbox environment                                        | A2       | ~6 % of search market (~500 M monthly searches); strong in desktop and enterprise                 | REST / SOAP (XML), OAuth 2.0              | No real-time webhooks — change tracking and reporting via polling                  | Campaign, AdGroup, Ad (TextAd, ResponsiveSearchAd, DynamicSearchAd), Keyword, Audience (RemarketingList, InMarketAudience, CustomAudience), Budget, BiddingScheme, Extension (Sitelink, Call, Location), UET Tag (Universal Event Tracking), ConversionGoal |
| **Twitter/X Ads**                    | S2 — Ads API with REST endpoints but reduced documentation post-acquisition; developer access increasingly restricted | A2       | ~$3 B annual ad revenue (declining); uncertain API future under X Corp                            | REST (JSON), OAuth 1.0a / OAuth 2.0       | No real-time webhooks — async analytics jobs                                       | Campaign, LineItem, PromotedTweet, FundingInstrument, TailoredAudience, AnalyticsReport (async), Card (Website, Video, App), MediaCreative                                                                                                                  |

### Best OSS for Domain Extraction

| Project             | Source                                                           | API Style | Key Entities                                                                          | Notes                                                                                                                                                                                                                                                                                                                      |
| ------------------- | ---------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Revive Adserver** | S3 — self-hosted, XML-RPC API, community-maintained PHP codebase | XML-RPC   | Campaign, Banner, Zone, Advertiser, Publisher, Website, Targeting (rules), Statistics | Self-hosted ad serving platform (fork of OpenX). ~1 k GitHub stars. Covers the ad-serving side (publisher-facing) rather than the demand side. Entity model is simpler than commercial DSPs but covers core concepts. Useful for understanding ad placement and zone-based targeting. XML-RPC API is dated but functional. |

### Tier A3 — Established Niche

| Provider          | Source                                                                 | Adoption | Notes                                                                                                                                                                                                                                                                                                                   |
| ----------------- | ---------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pinterest Ads** | S1 — Pinterest Ads API with REST endpoints, OAuth 2.0, sandbox account | A3       | Visual commerce and discovery platform. Entities: Campaign, AdGroup, Ad (Pin Promotion), Audience, ConversionTag, Targeting, Keyword, Report. ~450 M monthly active users. Strong for home decor, fashion, food, and DIY verticals. Unique "Pin" ad format blends natively with organic content.                        |
| **Snapchat Ads**  | S1 — Snap Marketing API with REST endpoints, OAuth 2.0, test mode      | A3       | Mobile-first, ephemeral content ads. Entities: Campaign, AdSquad, Ad, Creative (Single Image, Video, Collection, Story), Audience (SnapAudienceMatch, LookalikeAudience), Pixel (Snap Pixel), Segment, Reporting. ~800 M monthly users. Strong with younger demographics (13-34). Unique AR Lens and Filter ad formats. |
| **Criteo**        | S1 — Criteo Marketing API with REST endpoints, OAuth 2.0               | A3       | Retargeting and commerce media specialist. Entities: Campaign, AdSet, Ad, Audience, CatalogFeed, Budget, Report, Advertiser. Leader in retargeting / performance display. Strong in retail and eCommerce. Commerce media network spans ~19 k advertisers and ~1 k retailers.                                            |

### Tier A4 — Emerging / Niche

| Provider       | Source                                                            | Adoption | Notes                                                                                                                                                                                                                                                                                   |
| -------------- | ----------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Reddit Ads** | S1 — Reddit Ads API with REST endpoints, OAuth 2.0                | A4       | Community-driven advertising. Entities: Campaign, AdGroup, Ad (PromotedPost), Creative, Audience (Interest, Community), ConversionPixel, Report. Growing self-serve ad platform. Unique subreddit and interest-based targeting. ~100 M+ daily active users. Ad platform still maturing. |
| **Quora Ads**  | S2 — REST API with limited documentation and partner-level access | A4       | Q&A platform advertising. Entities: Campaign, AdSet, Ad, Audience (Question Targeting, Topic Targeting), ConversionPixel, Report. ~400 M monthly visitors. Niche but high-intent audiences. API access requires sales relationship; documentation is sparse.                            |

---

## Universal Entity Catalog

Every entity type observed across the providers above, grouped by advertising domain.

### Campaign Structure

| Entity                                           | Description                                                                  | Observed In                                                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Campaign**                                     | Top-level advertising campaign with objective, budget, schedule, and status  | All providers                                                                                                 |
| **AdGroup / AdSet / LineItem / AdSquad**         | A set of ads within a campaign sharing targeting, bid, and schedule settings | All providers (AdGroup in Google/Amazon/Bing, AdSet in Meta/Criteo, LineItem in Twitter, AdSquad in Snapchat) |
| **Ad / Creative / Banner / PromotedTweet / Pin** | An individual advertisement with creative content and delivery settings      | All providers (naming varies significantly by platform)                                                       |
| **Portfolio**                                    | A grouping of campaigns for shared budget management                         | Amazon Ads                                                                                                    |
| **CampaignGroup**                                | A grouping of campaigns for organisational purposes                          | LinkedIn                                                                                                      |

### Creative & Media

| Entity                                    | Description                                                                                 | Observed In                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Creative / AdCreative**                 | The visual and copy content of an ad (headline, description, image, video, CTA)             | Meta (AdCreative), TikTok, Snapchat, LinkedIn, Criteo              |
| **Asset / MediaCreative / Image / Video** | An uploaded media file (image, video, HTML5) used in ad creatives                           | Google Ads (Asset), TikTok (Image, Video), Twitter (MediaCreative) |
| **Card**                                  | A rich-media ad unit with image/video, title, and CTA button                                | Twitter (Website Card, Video Card, App Card)                       |
| **Extension / Sitelink**                  | An ad extension that adds extra information (sitelinks, callouts, locations, phone numbers) | Google Ads, Microsoft Advertising                                  |

### Targeting & Audiences

| Entity                                                    | Description                                                                                   | Observed In                                                                              |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Audience** (Custom / Lookalike / Matched / Remarketing) | A targetable group of users based on customer data, website visitors, or platform behaviour   | All providers                                                                            |
| **Keyword**                                               | A search term bid on for search ad placement, with match type (broad, phrase, exact)          | Google Ads, Amazon Ads, Microsoft Advertising, Pinterest                                 |
| **NegativeKeyword**                                       | A search term excluded from ad targeting to prevent irrelevant impressions                    | Google Ads, Amazon Ads, Microsoft Advertising                                            |
| **Targeting** (detailed specs)                            | Detailed targeting parameters (demographics, interests, behaviours, placements, devices)      | Meta (Targeting spec), Amazon (ProductTargeting, AudienceTargeting), Snapchat, Pinterest |
| **GeoTarget / Location**                                  | A geographic area (country, region, city, radius) for ad delivery targeting                   | Google Ads, Microsoft Advertising, all platforms via targeting specs                     |
| **Placement**                                             | A specific location where ads can appear (feed, stories, search, audience network, in-stream) | Meta, Snapchat, TikTok                                                                   |

### Measurement & Tracking

| Entity                                      | Description                                                                                 | Observed In                                                                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **ConversionTracking / Pixel / UET Tag**    | A tracking mechanism installed on advertiser's website to measure conversions               | All providers (ConversionAction in Google, Pixel in Meta/TikTok/Snapchat, UET Tag in Microsoft, Insight Tag in LinkedIn) |
| **ConversionGoal**                          | A defined conversion objective (purchase, lead, signup) with attribution settings           | Google Ads, Microsoft Advertising                                                                                        |
| **Report / Metrics / Analytics / Insights** | Performance data aggregated by dimensions (date, campaign, ad group, ad, placement, device) | All providers                                                                                                            |

### Account & Budget

| Entity                               | Description                                                                             | Observed In                                     |
| ------------------------------------ | --------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Account / AdAccount / Advertiser** | The top-level billing and organisational entity for managing ads                        | All providers                                   |
| **Budget**                           | A spending limit for a campaign (daily budget, lifetime budget, shared budget)          | All providers                                   |
| **BiddingStrategy / Scheme**         | A bid optimisation strategy (manual CPC, target CPA, target ROAS, maximize conversions) | Google Ads, Microsoft Advertising, Meta, Amazon |
| **FundingInstrument**                | A payment method (credit card, line of credit, insertion order) linked to an ad account | Twitter                                         |

### Organisation

| Entity                  | Description                                                      | Observed In     |
| ----------------------- | ---------------------------------------------------------------- | --------------- |
| **Label / Tag**         | A user-defined label for organising campaigns, ad groups, or ads | Google Ads      |
| **Zone**                | A placement area on a publisher's website where ads are served   | Revive Adserver |
| **Publisher / Website** | A content publisher or website that displays ads                 | Revive Adserver |

---

## VAOP Canonical Mapping

| Universal Entity                        | VAOP Canonical Object         | Mapping Notes                                                                                                                                                                                                           |
| --------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Campaign                                | `Campaign`                    | Direct mapping. VAOP `Campaign` captures name, objective, status, schedule, and budget reference. The canonical `Campaign` object is shared with Port 11 (Marketing Automation) to enable cross-channel campaign views. |
| AdGroup / AdSet / LineItem              | `ExternalObjectRef`           | Ad groups are structurally provider-specific (different naming, targeting models, and bid settings). Stored as typed reference with parent campaign ID, status, and bid amount.                                         |
| Ad / PromotedTweet / Pin                | `ExternalObjectRef`           | Individual ads are tightly coupled to provider-specific creative formats. Stored as reference with ad type, status, and preview URL.                                                                                    |
| Keyword                                 | `ExternalObjectRef`           | Keywords are search-specific and only apply to search ad platforms (Google, Bing, Amazon). Stored as reference with keyword text, match type, and bid.                                                                  |
| NegativeKeyword                         | `ExternalObjectRef`           | Negative keywords are search-specific exclusions. Stored as reference with keyword text and match type.                                                                                                                 |
| Audience (Custom / Lookalike / Matched) | `ExternalObjectRef`           | Audiences are provider-managed segments defined by proprietary matching and modelling. Stored as reference with audience type, size estimate, and source description.                                                   |
| Budget                                  | `ExternalObjectRef`           | Budget configurations vary by platform (daily vs. lifetime, shared vs. campaign-level). Stored as reference with amount, type, currency, and spend-to-date.                                                             |
| BiddingStrategy                         | `ExternalObjectRef`           | Bidding strategies are provider-specific optimisation algorithms. Stored as reference with strategy type and target metric.                                                                                             |
| ConversionTracking / Pixel / UET Tag    | `ExternalObjectRef`           | Conversion tracking mechanisms are provider-installed JavaScript snippets and server-side events. Stored as reference with tracking ID, type, and attribution window.                                                   |
| Report / Metrics / Analytics            | `ExternalObjectRef`           | Performance data is high-volume and schema-varies across providers. Stored as reference with summary metrics (impressions, clicks, spend, conversions) and report date range.                                           |
| Account / AdAccount                     | `ExternalObjectRef`           | Ad platform accounts. Stored as reference with account name, currency, timezone, and status. Not mapped to `Party` because ad accounts are billing/organisational constructs, not business parties.                     |
| Creative / AdCreative                   | `Document` (type: `creative`) | Mapped to `Document` with creative type discriminator. Stores creative name, format (image, video, carousel), and preview URL. Actual creative assets remain in the ad platform.                                        |
| Asset / MediaCreative / Image / Video   | `Document` (type: `media`)    | Mapped to `Document` with media type discriminator. Stores filename, MIME type, dimensions, and file size. Actual media files remain in the ad platform's asset library.                                                |
| Extension / Sitelink                    | `ExternalObjectRef`           | Ad extensions are search-platform-specific. Stored as reference with extension type and content summary.                                                                                                                |
| Targeting (detailed specs)              | `ExternalObjectRef`           | Targeting configurations are deeply provider-specific. Stored as reference with targeting summary (demographics, interests, placements).                                                                                |
| GeoTarget / Location                    | `ExternalObjectRef`           | Geographic targeting criteria. Stored as reference with location name, type (country, region, city, radius), and geo code.                                                                                              |
| Placement                               | `ExternalObjectRef`           | Ad placement specifications. Stored as reference with placement name and platform position.                                                                                                                             |
| ConversionGoal                          | `ExternalObjectRef`           | Conversion objectives with attribution settings. Stored as reference with goal name, type, and attribution model.                                                                                                       |
| Label / Tag                             | `ExternalObjectRef`           | Organisational labels. Stored as reference with label name.                                                                                                                                                             |
| FundingInstrument                       | `ExternalObjectRef`           | Payment methods for ad accounts. Stored as reference with instrument type and status. Not mapped to financial canonical objects as these are platform-internal billing constructs.                                      |
| Portfolio                               | `ExternalObjectRef`           | Campaign groupings for shared budget management. Stored as reference with portfolio name and total budget.                                                                                                              |

---

## Notes

- **Google Ads and Meta Ads** together account for over 50 % of global digital ad spend and must be the first two adapters implemented. Google dominates search advertising; Meta dominates social/display advertising.
- **Amazon Ads** is the fastest-growing major ad platform (retail media) and should be prioritised for eCommerce-focused customers alongside the two A1 providers.
- The `Campaign` canonical mapping is shared with Port 11 (Marketing Automation). This is intentional — VAOP's `Campaign` object provides a unified view across email campaigns (Mailchimp, HubSpot) and ad campaigns (Google, Meta). The `source` field on the canonical object distinguishes the originating port.
- **Ad platform APIs are predominantly pull-based** (polling for reports and status changes) rather than push-based (webhooks). This is a significant architectural consideration for VAOP adapters — most ad platforms generate reports asynchronously and require status polling. Adapters should implement scheduled sync jobs rather than real-time webhook handlers.
- **Twitter/X Ads** is classified as S2 due to increasingly restricted API access, degraded documentation, and uncertainty about the platform's developer programme under X Corp. Adapter investment should be cautious and closely monitored.
- The three-level campaign hierarchy (**Campaign > AdGroup > Ad**) is universal across all providers, though naming varies (AdSet in Meta, LineItem in Twitter, AdSquad in Snapchat). VAOP maps only the top-level Campaign to a canonical object; the sub-levels are provider-specific and stored as `ExternalObjectRef` with parent references to maintain the hierarchy.
- **Keyword-based targeting** is specific to search ad platforms (Google Ads, Microsoft Advertising, Amazon Ads) and does not apply to social/display platforms. The `listKeywords` port operation returns empty results for non-search providers.
