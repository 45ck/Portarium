import { useState, useEffect } from 'react'
import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from '../__root'
import { PageHeader } from '@/components/cockpit/page-header'
import { ThemePicker } from '@/components/cockpit/theme-picker'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

function SettingsPage() {
  const [relativeDates, setRelativeDates] = useState(() => {
    return localStorage.getItem('cockpit-date-format') !== 'absolute'
  })

  useEffect(() => {
    localStorage.setItem(
      'cockpit-date-format',
      relativeDates ? 'relative' : 'absolute',
    )
  }, [relativeDates])

  return (
    <div className="p-6 space-y-4">
      <PageHeader title="Settings" />

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-sm">Appearance</CardTitle>
          <CardDescription>Choose your cockpit theme</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemePicker />
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-sm">Workspace</CardTitle>
          <CardDescription>Current workspace information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-y-2 text-xs">
            <span className="text-muted-foreground">Workspace ID</span>
            <span className="font-mono">ws-demo</span>
            <span className="text-muted-foreground">Workspace Name</span>
            <span>Demo Workspace</span>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-sm">Preferences</CardTitle>
          <CardDescription>Customize display options</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="date-format" className="text-xs">
                Relative dates
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {relativeDates
                  ? 'Showing dates as "2 hours ago"'
                  : 'Showing dates as "2026-02-20 09:00"'}
              </p>
            </div>
            <Switch
              id="date-format"
              checked={relativeDates}
              onCheckedChange={setRelativeDates}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/config/settings',
  component: SettingsPage,
})
