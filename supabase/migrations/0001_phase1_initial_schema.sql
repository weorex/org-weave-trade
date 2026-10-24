-- Weorex Global Trade Partner Management System
-- Phase 1 initial migration: multi-tenant foundation
-- Organizations, memberships, configurable roles/permissions, entity type
-- builder tables, shared entities, contacts, products, logistics, workflows,
-- captures, audit logs, tenant authorization helpers, RLS, GRANTs.
--
-- Adaptations from the source document:
-- - user reference columns are plain UUIDs (no FKs into auth schema)
-- - explicit GRANT statements for the Data API
-- - automatic bootstrap of default system roles + permissions per organization
-- - updated_at maintenance triggers
-- - trusted audit-writing function

create extension if not exists pgcrypto;

-- =========================================================
-- Shared helper: updated_at maintenance
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

-- =========================================================
-- 1. ORGANIZATIONS
-- =========================================================

create table public.organizations (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text not null unique,
    owner_user_id uuid not null,
    default_currency char(3) not null default 'USD',
    default_country char(2),
    timezone text not null default 'UTC',
    settings jsonb not null default '{}'::jsonb,
    status text not null default 'active'
        check (status in ('active', 'suspended', 'archived')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (id, owner_user_id)
);

grant select, insert, update, delete on public.organizations to authenticated;
grant all on public.organizations to service_role;

alter table public.organizations enable row level security;

create trigger trg_organizations_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create table public.organization_memberships (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null
        references public.organizations(id) on delete cascade,
    user_id uuid not null,
    role_key text not null default 'member',
    status text not null default 'active'
        check (status in ('invited', 'active', 'suspended')),
    invited_by uuid,
    joined_at timestamptz,
    created_at timestamptz not null default now(),
    unique (organization_id, user_id),
    unique (organization_id, id)
);

grant select, insert, update, delete on public.organization_memberships to authenticated;
grant all on public.organization_memberships to service_role;

alter table public.organization_memberships enable row level security;

create index idx_memberships_user
    on public.organization_memberships(user_id, status);

create index idx_memberships_org
    on public.organization_memberships(organization_id, status);

-- Automatically create an owner membership when an organization
-- is created by its owner.
create or replace function public.create_organization_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.organization_memberships (
        organization_id, user_id, role_key, status, joined_at
    )
    values (
        new.id, new.owner_user_id, 'owner', 'active', now()
    )
    on conflict (organization_id, user_id) do nothing;

    return new;
end;
$$;

create trigger trg_create_organization_owner
after insert on public.organizations
for each row execute function public.create_organization_owner_membership();

-- =========================================================
-- 2. CONFIGURABLE ROLES AND PERMISSIONS
-- =========================================================

create table public.permission_definitions (
    permission_key text primary key,
    description text not null
);

grant select on public.permission_definitions to authenticated;
grant all on public.permission_definitions to service_role;

alter table public.permission_definitions enable row level security;

create policy permission_definitions_select
on public.permission_definitions for select to authenticated
using (true);

insert into public.permission_definitions
    (permission_key, description)
values
    ('entities.read', 'View business entities'),
    ('entities.create', 'Create business entities'),
    ('entities.update', 'Update business entities'),
    ('entities.delete', 'Delete business entities'),
    ('products.read', 'View products'),
    ('products.create', 'Create products'),
    ('products.update', 'Update products'),
    ('products.delete', 'Delete products'),
    ('contacts.manage', 'Manage contacts'),
    ('entity_types.manage', 'Configure entity types and fields'),
    ('workflows.manage', 'Configure workflows'),
    ('members.manage', 'Manage organization members'),
    ('roles.manage', 'Manage roles and permissions'),
    ('captures.review', 'Review captured website data'),
    ('audit.read', 'Read audit logs')
on conflict do nothing;

create table public.organization_roles (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null
        references public.organizations(id) on delete cascade,
    role_key text not null,
    display_name text not null,
    description text,
    is_system boolean not null default false,
    created_at timestamptz not null default now(),
    unique (organization_id, role_key),
    unique (organization_id, id)
);

grant select, insert, update, delete on public.organization_roles to authenticated;
grant all on public.organization_roles to service_role;

alter table public.organization_roles enable row level security;

create table public.role_permissions (
    organization_id uuid not null,
    role_id uuid not null,
    permission_key text not null
        references public.permission_definitions(permission_key),
    created_at timestamptz not null default now(),
    primary key (organization_id, role_id, permission_key),
    foreign key (organization_id, role_id)
        references public.organization_roles(organization_id, id)
        on delete cascade
);

grant select, insert, update, delete on public.role_permissions to authenticated;
grant all on public.role_permissions to service_role;

alter table public.role_permissions enable row level security;

create index idx_role_permissions_role
    on public.role_permissions(organization_id, role_id);

-- Trusted bootstrap: every new organization receives system roles
-- (owner, admin, member) with a default permission set. This is the
-- "create default roles and permissions" prerequisite from the schema doc.
create or replace function public.bootstrap_organization_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_all text[];
    v_member text[] := array[
        'entities.read', 'entities.create',
        'products.read', 'products.create',
        'contacts.manage'
    ];
begin
    v_all := array(select permission_key from public.permission_definitions);

    insert into public.organization_roles (organization_id, role_key, display_name, description, is_system)
    values
        (new.id, 'owner', 'Owner', 'Full control of the organization', true),
        (new.id, 'admin', 'Administrator', 'Manage everything except ownership transfer', true),
        (new.id, 'member', 'Member', 'Work with entities, products and contacts', true);

    insert into public.role_permissions (organization_id, role_id, permission_key)
    select new.id, r.id, p.permission_key
    from public.organization_roles r
    join unnest(v_all) as p(permission_key) on true
    where r.organization_id = new.id and r.role_key in ('owner', 'admin');

    insert into public.role_permissions (organization_id, role_id, permission_key)
    select new.id, r.id, p.permission_key
    from public.organization_roles r
    join unnest(v_member) as p(permission_key) on true
    where r.organization_id = new.id and r.role_key = 'member';

    return new;
end;
$$;

create trigger trg_bootstrap_organization_roles
after insert on public.organizations
for each row execute function public.bootstrap_organization_roles();

-- =========================================================
-- 3. ENTITY TYPE BUILDER
-- =========================================================

create table public.entity_types (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null
        references public.organizations(id) on delete cascade,
    name text not null,
    slug text not null,
    description text,
    icon text,
    is_system boolean not null default false,
    is_active boolean not null default true,
    config_version integer not null default 1,
    created_by uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (organization_id, slug),
    unique (organization_id, id)
);

grant select, insert, update, delete on public.entity_types to authenticated;
grant all on public.entity_types to service_role;

alter table public.entity_types enable row level security;

create trigger trg_entity_types_updated_at
before update on public.entity_types
for each row execute function public.set_updated_at();

create table public.entity_field_definitions (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null,
    entity_type_id uuid not null,
    field_key text not null,
    label text not null,
    field_type text not null check (
        field_type in (
            'text', 'textarea', 'email', 'phone', 'url',
            'number', 'currency', 'date', 'datetime',
            'boolean', 'country', 'select', 'multi_select',
            'relationship', 'file', 'json'
        )
    ),
    description text,
    is_required boolean not null default false,
    is_searchable boolean not null default false,
    is_filterable boolean not null default false,
    is_visible_in_table boolean not null default false,
    is_active boolean not null default true,
    sort_order integer not null default 0,
    options jsonb not null default '[]'::jsonb,
    validation_rules jsonb not null default '{}'::jsonb,
    default_value jsonb,
    relationship_config jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    foreign key (organization_id, entity_type_id)
        references public.entity_types(organization_id, id)
        on delete cascade,

    unique (organization_id, entity_type_id, field_key),
    unique (organization_id, id)
);

grant select, insert, update, delete on public.entity_field_definitions to authenticated;
grant all on public.entity_field_definitions to service_role;

alter table public.entity_field_definitions enable row level security;

create trigger trg_field_definitions_updated_at
before update on public.entity_field_definitions
for each row execute function public.set_updated_at();

create table public.entity_type_layouts (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null,
    entity_type_id uuid not null,
    layout_key text not null,
    layout_config jsonb not null default '{}'::jsonb,
    version integer not null default 1,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    foreign key (organization_id, entity_type_id)
        references public.entity_types(organization_id, id)
        on delete cascade,

    unique (organization_id, entity_type_id, layout_key)
);

grant select, insert, update, delete on public.entity_type_layouts to authenticated;
grant all on public.entity_type_layouts to service_role;

alter table public.entity_type_layouts enable row level security;

create trigger trg_entity_type_layouts_updated_at
before update on public.entity_type_layouts
for each row execute function public.set_updated_at();

-- =========================================================
-- 4. SHARED BUSINESS ENTITIES
-- =========================================================

create table public.entities (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null
        references public.organizations(id) on delete cascade,
    entity_type_id uuid not null,
    company_name text not null,
    legal_name text,
    website_url text,
    website_domain text,
    email text,
    phone text,
    country_code char(2),
    state_region text,
    city text,
    postal_code text,
    address text,
    description text,
    status text not null default 'active',
    verification_status text not null default 'unverified'
        check (
            verification_status in (
                'unverified', 'pending', 'verified', 'rejected'
            )
        ),
    tags text[] not null default array[]::text[],
    custom_data jsonb not null default '{}'::jsonb,
    source_url text,
    created_by uuid,
    updated_by uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    archived_at timestamptz,

    foreign key (organization_id, entity_type_id)
        references public.entity_types(organization_id, id),

    unique (organization_id, id)
);

grant select, insert, update, delete on public.entities to authenticated;
grant all on public.entities to service_role;

alter table public.entities enable row level security;

create trigger trg_entities_updated_at
before update on public.entities
for each row execute function public.set_updated_at();

create index idx_entities_org_type
    on public.entities(organization_id, entity_type_id);

create index idx_entities_name
    on public.entities(organization_id, company_name);

create index idx_entities_domain
    on public.entities(organization_id, website_domain);

create index idx_entities_custom_data
    on public.entities using gin (custom_data);

create index idx_entities_tags
    on public.entities using gin (tags);

-- =========================================================
-- 5. CONTACTS
-- =========================================================

create table public.contacts (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null
        references public.organizations(id) on delete cascade,
    entity_id uuid not null,
    first_name text,
    last_name text,
    full_name text not null,
    job_title text,
    department text,
    email text,
    phone text,
    mobile text,
    linkedin_url text,
    is_primary boolean not null default false,
    notes text,
    custom_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    foreign key (organization_id, entity_id)
        references public.entities(organization_id, id)
        on delete cascade,

    unique (organization_id, id)
);

grant select, insert, update, delete on public.contacts to authenticated;
grant all on public.contacts to service_role;

alter table public.contacts enable row level security;

create trigger trg_contacts_updated_at
before update on public.contacts
for each row execute function public.set_updated_at();

create index idx_contacts_entity
    on public.contacts(organization_id, entity_id);

create index idx_contacts_email
    on public.contacts(organization_id, email);

-- =========================================================
-- 6. PRODUCTS AND SUPPLIER RELATIONSHIPS
-- =========================================================

create table public.products (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null
        references public.organizations(id) on delete cascade,
    sku text,
    name text not null,
    slug text,
    category text,
    description text,
    specifications jsonb not null default '{}'::jsonb,
    unit_of_measure text,
    minimum_order_quantity numeric(18,4),
    production_capacity numeric(18,4),
    capacity_uom text,
    default_currency char(3) default 'USD',
    images jsonb not null default '[]'::jsonb,
    certifications jsonb not null default '[]'::jsonb,
    packaging_details jsonb not null default '{}'::jsonb,
    status text not null default 'active',
    created_by uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    unique (organization_id, id)
);

grant select, insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;

alter table public.products enable row level security;

create trigger trg_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create unique index idx_products_org_sku
    on public.products(organization_id, sku)
    where sku is not null;

create index idx_products_name
    on public.products(organization_id, name);

create index idx_products_specifications
    on public.products using gin (specifications);

create table public.entity_products (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null,
    entity_id uuid not null,
    product_id uuid not null,
    supplier_sku text,
    supplier_product_name text,
    minimum_order_quantity numeric(18,4),
    lead_time_days integer,
    is_primary_supplier boolean not null default false,
    supplier_specifications jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),

    foreign key (organization_id, entity_id)
        references public.entities(organization_id, id)
        on delete cascade,

    foreign key (organization_id, product_id)
        references public.products(organization_id, id)
        on delete cascade,

    unique (organization_id, entity_id, product_id)
);

grant select, insert, update, delete on public.entity_products to authenticated;
grant all on public.entity_products to service_role;

alter table public.entity_products enable row level security;

create table public.product_prices (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null,
    product_id uuid not null,
    supplier_entity_id uuid,
    currency char(3) not null,
    unit_price numeric(18,6) not null check (unit_price >= 0),
    quantity_min numeric(18,4),
    quantity_max numeric(18,4),
    price_basis text,
    valid_from date,
    valid_until date,
    source_url text,
    created_by uuid,
    created_at timestamptz not null default now(),

    foreign key (organization_id, product_id)
        references public.products(organization_id, id)
        on delete cascade,

    foreign key (organization_id, supplier_entity_id)
        references public.entities(organization_id, id),

    check (
        valid_until is null or valid_from is null
        or valid_until >= valid_from
    )
);

grant select, insert, update, delete on public.product_prices to authenticated;
grant all on public.product_prices to service_role;

alter table public.product_prices enable row level security;

create index idx_product_prices_lookup
    on public.product_prices(organization_id, product_id, valid_from);

-- =========================================================
-- 7. ENTITY-TO-ENTITY RELATIONSHIPS
-- =========================================================

create table public.entity_relationships (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null,
    source_entity_id uuid not null,
    target_entity_id uuid not null,
    relationship_type text not null,
    metadata jsonb not null default '{}'::jsonb,
    created_by uuid,
    created_at timestamptz not null default now(),

    foreign key (organization_id, source_entity_id)
        references public.entities(organization_id, id)
        on delete cascade,

    foreign key (organization_id, target_entity_id)
        references public.entities(organization_id, id)
        on delete cascade,

    check (source_entity_id <> target_entity_id),

    unique (
        organization_id,
        source_entity_id,
        target_entity_id,
        relationship_type
    )
);

grant select, insert, update, delete on public.entity_relationships to authenticated;
grant all on public.entity_relationships to service_role;

alter table public.entity_relationships enable row level security;

-- =========================================================
-- 8. LOGISTICS: ROUTES, RATES, FLEET AND SERVICE AREAS
-- =========================================================

create table public.shipping_routes (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null,
    shipping_agent_entity_id uuid not null,
    origin_port text,
    origin_country char(2),
    destination_port text,
    destination_country char(2),
    transport_mode text not null default 'sea',
    service_type text,
    container_types text[] not null default array[]::text[],
    transit_days_min integer,
    transit_days_max integer,
    notes text,
    created_at timestamptz not null default now(),

    unique (organization_id, id),

    foreign key (organization_id, shipping_agent_entity_id)
        references public.entities(organization_id, id)
        on delete cascade,

    check (
        transit_days_max is null or transit_days_min is null
        or transit_days_max >= transit_days_min
    )
);

grant select, insert, update, delete on public.shipping_routes to authenticated;
grant all on public.shipping_routes to service_role;

alter table public.shipping_routes enable row level security;

create table public.shipping_rates (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null,
    route_id uuid not null,
    rate_name text,
    currency char(3) not null,
    amount numeric(18,4) not null check (amount >= 0),
    unit_basis text not null,
    minimum_quantity numeric(18,4),
    valid_from date,
    valid_until date,
    terms text,
    source_url text,
    created_at timestamptz not null default now(),

    foreign key (organization_id, route_id)
        references public.shipping_routes(organization_id, id)
        on delete cascade
);

grant select, insert, update, delete on public.shipping_rates to authenticated;
grant all on public.shipping_rates to service_role;

alter table public.shipping_rates enable row level security;

create table public.transporter_assets (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null,
    transporter_entity_id uuid not null,
    asset_type text not null,
    vehicle_registration text,
    capacity numeric(18,4),
    capacity_uom text,
    description text,
    custom_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),

    foreign key (organization_id, transporter_entity_id)
        references public.entities(organization_id, id)
        on delete cascade
);

grant select, insert, update, delete on public.transporter_assets to authenticated;
grant all on public.transporter_assets to service_role;

alter table public.transporter_assets enable row level security;

create table public.transporter_service_areas (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null,
    transporter_entity_id uuid not null,
    country_code char(2),
    state_region text,
    city text,
    postal_code_pattern text,
    rate_notes text,
    custom_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),

    foreign key (organization_id, transporter_entity_id)
        references public.entities(organization_id, id)
        on delete cascade
);

grant select, insert, update, delete on public.transporter_service_areas to authenticated;
grant all on public.transporter_service_areas to service_role;

alter table public.transporter_service_areas enable row level security;

-- =========================================================
-- 9. CONFIGURABLE WORKFLOWS
-- =========================================================

create table public.workflow_definitions (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null,
    name text not null,
    description text,
    trigger_config jsonb not null default '{}'::jsonb,
    steps jsonb not null default '[]'::jsonb,
    is_active boolean not null default false,
    version integer not null default 1,
    created_by uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    foreign key (organization_id)
        references public.organizations(id) on delete cascade,

    unique (organization_id, id)
);

grant select, insert, update, delete on public.workflow_definitions to authenticated;
grant all on public.workflow_definitions to service_role;

alter table public.workflow_definitions enable row level security;

create trigger trg_workflow_definitions_updated_at
before update on public.workflow_definitions
for each row execute function public.set_updated_at();

create table public.workflow_runs (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null,
    workflow_id uuid not null,
    entity_id uuid,
    status text not null default 'pending'
        check (
            status in (
                'pending', 'running', 'completed', 'failed', 'cancelled'
            )
        ),
    current_step integer not null default 0,
    execution_context jsonb not null default '{}'::jsonb,
    error_details jsonb,
    started_at timestamptz,
    finished_at timestamptz,
    created_at timestamptz not null default now(),

    foreign key (organization_id, workflow_id)
        references public.workflow_definitions(organization_id, id),

    foreign key (organization_id, entity_id)
        references public.entities(organization_id, id)
);

grant select, insert, update, delete on public.workflow_runs to authenticated;
grant all on public.workflow_runs to service_role;

alter table public.workflow_runs enable row level security;

create index idx_workflow_runs_status
    on public.workflow_runs(organization_id, status, created_at);

-- =========================================================
-- 10. CHROME EXTENSION CAPTURES
-- =========================================================

create table public.data_captures (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null,
    captured_by uuid not null,
    source_url text not null,
    source_domain text,
    page_title text,
    capture_type text not null default 'company'
        check (
            capture_type in (
                'company', 'product', 'contact', 'table', 'mixed'
            )
        ),
    target_entity_type_id uuid,
    captured_data jsonb not null default '{}'::jsonb,
    detected_tables jsonb not null default '[]'::jsonb,
    status text not null default 'pending'
        check (
            status in (
                'pending', 'reviewing', 'approved', 'rejected', 'imported'
            )
        ),
    matched_entity_id uuid,
    error_details jsonb,
    reviewed_by uuid,
    reviewed_at timestamptz,
    created_at timestamptz not null default now(),

    foreign key (organization_id, target_entity_type_id)
        references public.entity_types(organization_id, id),

    foreign key (organization_id, matched_entity_id)
        references public.entities(organization_id, id),

    foreign key (organization_id)
        references public.organizations(id) on delete cascade
);

grant select, insert, update, delete on public.data_captures to authenticated;
grant all on public.data_captures to service_role;

alter table public.data_captures enable row level security;

create index idx_data_captures_review
    on public.data_captures(organization_id, status, created_at desc);

create index idx_data_captures_payload
    on public.data_captures using gin (captured_data);

-- =========================================================
-- 11. AUDIT LOGS
-- =========================================================

create table public.audit_logs (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null,
    actor_user_id uuid,
    action text not null,
    resource_type text not null,
    resource_id uuid,
    request_id text,
    changes jsonb not null default '{}'::jsonb,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),

    foreign key (organization_id)
        references public.organizations(id) on delete cascade
);

grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;

alter table public.audit_logs enable row level security;

create index idx_audit_logs_org_date
    on public.audit_logs(organization_id, created_at desc);

create index idx_audit_logs_resource
    on public.audit_logs(organization_id, resource_type, resource_id);

-- Trusted audit-writing function: members may append audit records but
-- there is no direct INSERT policy on audit_logs.
create or replace function public.write_audit_log(
    p_organization_id uuid,
    p_action text,
    p_resource_type text,
    p_resource_id uuid default null,
    p_changes jsonb default '{}'::jsonb,
    p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_id uuid;
begin
    if not public.is_org_member(p_organization_id) then
        raise exception 'Not a member of this organization';
    end if;

    insert into public.audit_logs (
        organization_id, actor_user_id, action, resource_type,
        resource_id, changes, metadata
    )
    values (
        p_organization_id, (select auth.uid()), p_action, p_resource_type,
        p_resource_id, p_changes, p_metadata
    )
    returning id into v_id;

    return v_id;
end;
$$;

grant execute on public.write_audit_log to authenticated;

-- =========================================================
-- 12. TENANT AUTHORIZATION HELPERS
-- =========================================================

create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.organization_memberships m
        join public.organizations o
          on o.id = m.organization_id
        where m.organization_id = p_org_id
          and m.user_id = (select auth.uid())
          and m.status = 'active'
          and o.status = 'active'
    );
$$;

create or replace function public.has_org_role(
    p_org_id uuid,
    p_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.organization_memberships m
        where m.organization_id = p_org_id
          and m.user_id = (select auth.uid())
          and m.status = 'active'
          and m.role_key = any(p_roles)
    );
$$;

create or replace function public.has_org_permission(
    p_org_id uuid,
    p_permission text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.organization_memberships m
        join public.organization_roles r
          on r.organization_id = m.organization_id
         and r.role_key = m.role_key
        join public.role_permissions rp
          on rp.organization_id = r.organization_id
         and rp.role_id = r.id
        where m.organization_id = p_org_id
          and m.user_id = (select auth.uid())
          and m.status = 'active'
          and rp.permission_key = p_permission
    )
    or public.has_org_role(p_org_id, array['owner', 'admin']);
$$;

grant execute on public.is_org_member to authenticated;
grant execute on public.has_org_role to authenticated;
grant execute on public.has_org_permission to authenticated;

-- =========================================================
-- 13. ENABLE ROW LEVEL SECURITY (remaining tables)
-- =========================================================

-- (organizations, memberships, permission_definitions, roles,
--  role_permissions, entity types, layouts, entities, contacts,
--  products, links, prices, relationships, logistics, workflows,
--  captures and audit logs are enabled above at table creation.)

-- =========================================================
-- 14. ORGANIZATION AND MEMBERSHIP POLICIES
-- =========================================================

create policy organizations_select
on public.organizations for select to authenticated
using (public.is_org_member(id));

create policy organizations_insert
on public.organizations for insert to authenticated
with check (owner_user_id = (select auth.uid()));

create policy organizations_update
on public.organizations for update to authenticated
using (public.has_org_role(id, array['owner', 'admin']))
with check (public.has_org_role(id, array['owner', 'admin']));

create policy memberships_select
on public.organization_memberships for select to authenticated
using (
    user_id = (select auth.uid())
    or public.has_org_role(
        organization_id, array['owner', 'admin']
    )
);

-- Memberships and roles are granted only through trusted server-side
-- paths; there is no client-writable insert/update policy here beyond
-- what ownership checks allow below.
create policy memberships_insert
on public.organization_memberships for insert to authenticated
with check (
    public.has_org_role(
        organization_id, array['owner', 'admin']
    )
    and user_id <> (select auth.uid())
);

create policy memberships_update
on public.organization_memberships for update to authenticated
using (
    public.has_org_role(
        organization_id, array['owner', 'admin']
    )
    and user_id <> (select auth.uid())
)
with check (
    public.has_org_role(
        organization_id, array['owner', 'admin']
    )
    and user_id <> (select auth.uid())
);

create policy memberships_delete
on public.organization_memberships for delete to authenticated
using (
    public.has_org_role(
        organization_id, array['owner', 'admin']
    )
    and user_id <> (select auth.uid())
);

-- =========================================================
-- 15. TENANT-SCOPED POLICIES
-- =========================================================

create policy entity_types_select
on public.entity_types for select to authenticated
using (public.is_org_member(organization_id));

create policy entity_types_admin_all
on public.entity_types for all to authenticated
using (
    public.has_org_role(
        organization_id, array['owner', 'admin']
    )
)
with check (
    public.has_org_role(
        organization_id, array['owner', 'admin']
    )
);

create policy field_definitions_select
on public.entity_field_definitions for select to authenticated
using (public.is_org_member(organization_id));

create policy field_definitions_admin_all
on public.entity_field_definitions for all to authenticated
using (
    public.has_org_role(
        organization_id, array['owner', 'admin']
    )
)
with check (
    public.has_org_role(
        organization_id, array['owner', 'admin']
    )
);

create policy layouts_select
on public.entity_type_layouts for select to authenticated
using (public.is_org_member(organization_id));

create policy layouts_admin_all
on public.entity_type_layouts for all to authenticated
using (
    public.has_org_role(
        organization_id, array['owner', 'admin']
    )
)
with check (
    public.has_org_role(
        organization_id, array['owner', 'admin']
    )
);

-- Entities: permission-aware reads and writes.

create policy entities_select
on public.entities for select to authenticated
using (
    public.is_org_member(organization_id)
    and public.has_org_permission(organization_id, 'entities.read')
);

create policy entities_insert
on public.entities for insert to authenticated
with check (
    public.is_org_member(organization_id)
    and created_by = (select auth.uid())
    and public.has_org_permission(organization_id, 'entities.create')
);

create policy entities_update
on public.entities for update to authenticated
using (
    public.is_org_member(organization_id)
    and public.has_org_permission(organization_id, 'entities.update')
)
with check (
    public.is_org_member(organization_id)
    and public.has_org_permission(organization_id, 'entities.update')
);

create policy entities_delete
on public.entities for delete to authenticated
using (
    public.is_org_member(organization_id)
    and public.has_org_permission(organization_id, 'entities.delete')
);

-- Contacts

create policy contacts_select
on public.contacts for select to authenticated
using (public.is_org_member(organization_id));

create policy contacts_write
on public.contacts for all to authenticated
using (
    public.is_org_member(organization_id)
    and public.has_org_permission(organization_id, 'contacts.manage')
)
with check (
    public.is_org_member(organization_id)
    and public.has_org_permission(organization_id, 'contacts.manage')
);

-- Products

create policy products_select
on public.products for select to authenticated
using (
    public.is_org_member(organization_id)
    and public.has_org_permission(organization_id, 'products.read')
);

create policy products_insert
on public.products for insert to authenticated
with check (
    public.is_org_member(organization_id)
    and public.has_org_permission(organization_id, 'products.create')
);

create policy products_update
on public.products for update to authenticated
using (
    public.is_org_member(organization_id)
    and public.has_org_permission(organization_id, 'products.update')
)
with check (
    public.is_org_member(organization_id)
    and public.has_org_permission(organization_id, 'products.update')
);

create policy products_delete
on public.products for delete to authenticated
using (
    public.is_org_member(organization_id)
    and public.has_org_permission(organization_id, 'products.delete')
);

create policy entity_products_access
on public.entity_products for all to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy product_prices_access
on public.product_prices for all to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy entity_relationships_access
on public.entity_relationships for all to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

-- Logistics

create policy shipping_routes_access
on public.shipping_routes for all to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy shipping_rates_access
on public.shipping_rates for all to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy transporter_assets_access
on public.transporter_assets for all to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy transporter_areas_access
on public.transporter_service_areas for all to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

-- Workflows

create policy workflow_definitions_select
on public.workflow_definitions for select to authenticated
using (public.is_org_member(organization_id));

create policy workflow_definitions_admin_all
on public.workflow_definitions for all to authenticated
using (
    public.has_org_permission(organization_id, 'workflows.manage')
)
with check (
    public.has_org_permission(organization_id, 'workflows.manage')
);

create policy workflow_runs_access
on public.workflow_runs for all to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

-- Browser capture

create policy captures_select
on public.data_captures for select to authenticated
using (
    public.is_org_member(organization_id)
    and (
        captured_by = (select auth.uid())
        or public.has_org_permission(
            organization_id, 'captures.review'
        )
    )
);

create policy captures_insert
on public.data_captures for insert to authenticated
with check (
    public.is_org_member(organization_id)
    and captured_by = (select auth.uid())
);

create policy captures_review
on public.data_captures for update to authenticated
using (
    public.is_org_member(organization_id)
    and public.has_org_permission(
        organization_id, 'captures.review'
    )
)
with check (
    public.is_org_member(organization_id)
    and public.has_org_permission(
        organization_id, 'captures.review'
    )
);

-- Audit logs: members with audit.read may read; writes go through
-- the trusted write_audit_log function only.

create policy audit_logs_select
on public.audit_logs for select to authenticated
using (
    public.is_org_member(organization_id)
    and public.has_org_permission(organization_id, 'audit.read')
);

-- Role management policies

create policy organization_roles_select
on public.organization_roles for select to authenticated
using (public.is_org_member(organization_id));

create policy organization_roles_admin_all
on public.organization_roles for all to authenticated
using (
    public.has_org_role(
        organization_id, array['owner', 'admin']
    )
)
with check (
    public.has_org_role(
        organization_id, array['owner', 'admin']
    )
);

create policy role_permissions_select
on public.role_permissions for select to authenticated
using (public.is_org_member(organization_id));

create policy role_permissions_admin_all
on public.role_permissions for all to authenticated
using (
    public.has_org_role(
        organization_id, array['owner', 'admin']
    )
)
with check (
    public.has_org_role(
        organization_id, array['owner', 'admin']
    )
);
