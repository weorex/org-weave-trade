import { createFileRoute, Link } from '@tanstack/react-router'
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { getOrders, getOrder } from '@/services/orders.functions'
import { OrdersList } from '@/components/orders/orders-list'
import { OrderDetailView } from '@/components/orders/order-detail'
import { AppShell } from '@/components/app-shell'
import { pageHead } from '@/lib/page-head'
import { Button } from '@/components/ui/button'

export const ordersQuery = (org: string, user: string) => queryOptions({ queryKey: ['orders', user, org], queryFn: () => getOrders({ data: { organizationId: org } }) })
export const orderQuery = (org: string, user: string, id: string) => queryOptions({ queryKey: ['orders', user, org, id], queryFn: () => getOrder({ data: { organizationId: org, orderId: id } }) })
function Unavailable() { return <main className="simple-page"><h1 className="mt-12 text-2xl font-semibold">Orders unavailable</h1><p className="my-5 text-sm text-muted-foreground">Choose an organization or order you have access to.</p><Button asChild><Link to="/dashboard">Return to dashboard</Link></Button></main> }
export const Route = createFileRoute('/_authenticated/orders')({
  validateSearch: s => z.object({ org: z.string().uuid(), id: z.string().uuid().optional() }).parse(s),
  loaderDeps: ({ search }) => ({ org: search.org, id: search.id }),
  loader: ({ context, deps }) => deps.id ? context.queryClient.ensureQueryData(orderQuery(deps.org, context.user.id, deps.id)) : context.queryClient.ensureQueryData(ordersQuery(deps.org, context.user.id)),
  head: () => pageHead('Orders', 'Weorex export orders and stock purchases with supplier and logistics quotes, payments, documents and timeline.'),
  component: OrdersPage, errorComponent: Unavailable, notFoundComponent: Unavailable,
})
function OrdersPage() {
  const { org, id } = Route.useSearch(); const { user } = Route.useRouteContext()
  return <AppShell user={user} activeOrgId={org} title={id ? 'Order' : 'Orders'}>{id ? <Detail org={org} userId={user.id} id={id}/> : <List org={org} userId={user.id}/>}</AppShell>
}
function List({ org, userId }: { org: string; userId: string }) { const { data } = useSuspenseQuery(ordersQuery(org, userId)); return <OrdersList org={org} userId={userId} data={data}/> }
function Detail({ org, userId, id }: { org: string; userId: string; id: string }) { const { data } = useSuspenseQuery(orderQuery(org, userId, id)); return <OrderDetailView key={id} org={org} userId={userId} data={data}/> }
