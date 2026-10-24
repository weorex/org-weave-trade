import { createFileRoute,Link } from '@tanstack/react-router'
import { queryOptions,useSuspenseQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { getTradeDirectory } from '@/services/trade.functions'
import { TradeWorkspace } from '@/components/trade/trade-workspace'
import { pageHead } from '@/lib/page-head'
import { Button } from '@/components/ui/button'
import { Brand } from '@/components/brand'
const directoryQuery=(org:string,userId:string)=>queryOptions({queryKey:['trade-directory',userId,org],queryFn:()=>getTradeDirectory({data:{organizationId:org}})})
export const Route=createFileRoute('/_authenticated/trade')({
  validateSearch:s=>z.object({org:z.string().uuid()}).parse(s),loaderDeps:({search})=>({org:search.org}),
  loader:({context,deps})=>context.queryClient.ensureQueryData(directoryQuery(deps.org,context.user.id)),
  head:()=>pageHead('Manufacturer & product catalogue','Manage Weorex manufacturers, suppliers, product catalogues, contacts, certifications, and currency-specific price history.'),
  component:TradePage,
  errorComponent:()=> <main className="simple-page"><Brand/><h1 className="mt-12 text-2xl font-semibold">Trade workspace unavailable</h1><p className="my-5 text-sm text-muted-foreground">Choose an organization you have access to.</p><Button asChild><Link to="/dashboard">Return to dashboard</Link></Button></main>,
})
function TradePage(){const {org}=Route.useSearch();const {user}=Route.useRouteContext();const {data}=useSuspenseQuery(directoryQuery(org,user.id));return <TradeWorkspace key={org} org={org} userId={user.id} directory={data}/>}