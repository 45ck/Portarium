import { PageHeader } from '../../../../components/cockpit/page-header';
import { Badge } from '../../../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';

export default function ExampleOpsOverviewRoute() {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Operations Overview"
        description="Host-owned placeholder for a compile-time installed reference extension"
      />

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Extension Boundary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            This route is provided by Cockpit as a neutral stub. A production extension can replace
            the implementation while keeping manifest metadata, guard declarations, and capability
            scopes visible to the host.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">asset:read</Badge>
            <Badge variant="outline">extensions.read</Badge>
            <Badge variant="outline">internal</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
