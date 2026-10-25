import { createFileRoute, Link } from '@tanstack/react-router'
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { getLogisticsWorkspace } from '@/services/logistics.functions'
import { LogisticsWorkspace } from '@/components/trade/logistics-workspace'
import { pageHead } from '@/lib/page-head'
import { Button } from '@/components/ui/button'
import { AppShell } from '@/components/app-shell'
const workspace = (org: string, user: string) => queryOptions({ queryKey: ['logistics', user, org], queryFn: () => getLogisticsWorkspace({ data: { organizationId: org } }) })
function Unavailable() { return <main className="simple-page"><h1 className="mt-12 text-2xl font-semibold">Logistics workspace unavailable</h1><Button className="mt-6" asChild><Link to="/dashboard">Return to dashboard</Link></Button></main> }
export const Route = createFileRoute('/_authenticated/logistics')({
  validateSearch: s => z.object({ org: z.string().uuid() }).parse(s), loaderDeps: ({ search }) => ({ org: search.org }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(workspace(deps.org, context.user.id)),
  head: () => pageHead('Shipping & transport', 'Weorex shipping agents, ports, FCL and LCL routes, transporters, vehicles, service areas, documents and historical rates.'),
  component: LogisticsPage, errorComponent: Unavailable, notFoundComponent: Unavailable,
})
function LogisticsPage() { const { org } = Route.useSearch(); const { user } = Route.useRouteContext(); const { data } = useSuspenseQuery(workspace(org, user.id)); return <AppShell user={user} activeOrgId={org} title="Shipping & transport"><LogisticsWorkspace key={org} org={org} userId={user.id} data={data}/></AppShell> }