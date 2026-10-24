import { takeReturnPath } from '@/lib/return-to'
import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Brand } from '@/components/brand';
import { pageHead } from '@/lib/page-head';
export const Route = createFileRoute("/")({
  head: () => pageHead('Global Trade Workspace', 'Weorex organization-based global trade partner management.'),
  component: Index,
});
function Index() {
  const navigate = useNavigate();
  useEffect(() => { void supabase.auth.getUser().then(({data})=>{const back=data.user?takeReturnPath():null;if(back){window.location.replace(back);return}void navigate({to:data.user?'/dashboard':'/auth',replace:true})}); },[navigate]);
  return <main className="simple-page"><Brand/><p className="mt-8 text-muted-foreground">Opening your workspace…</p></main>;
}
