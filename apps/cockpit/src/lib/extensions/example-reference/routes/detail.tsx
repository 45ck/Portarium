import { PageHeader } from '../../../../components/cockpit/page-header';
import { Badge } from '../../../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';

export default function ExampleReferenceDetailRoute() {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Reference Detail"
        description="Host-owned placeholder for a declared extension detail route"
      />

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Detail Contract</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            This stub exists so every declared external route has a compile-time loader owned by
            Cockpit. Runtime data can be supplied later through Portarium APIs and declared
            extension scopes.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">extension:inspect</Badge>
            <Badge variant="outline">extensions.inspect</Badge>
            <Badge variant="outline">restricted</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
