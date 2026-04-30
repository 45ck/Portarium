import { PageHeader } from '../../../../components/cockpit/page-header';
import { Badge } from '../../../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';

export default function ExampleReferenceReviewRoute() {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Reference Review"
        description="Host-owned placeholder for a declared extension review route"
      />

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Review Contract</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            This stub exists so every declared external route has a compile-time loader owned by
            Cockpit. Runtime data can be supplied later through Portarium APIs and declared scopes.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">evidence:read</Badge>
            <Badge variant="outline">approvals.read</Badge>
            <Badge variant="outline">restricted</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
