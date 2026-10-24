# Org Weave Trade

Build Phase 1 of the Weorex Global Trade Partner Management System.

Use React, TypeScript, Vite, Tailwind CSS, shadcn/ui, and Supabase PostgreSQL.

1. Build the responsive dashboard, authentication, organization onboarding, and organization switcher.

2. Support multiple organizations and secure membership-based access.

3. Resolve the active organization on every authenticated request.

4. Implement a typed service layer, migrations, and PostgreSQL Row Level Security.

5. Never expose service-role keys or allow users to grant themselves elevated permissions.

6. Do not use mock authentication or fake database data.

7. Test organization creation, switching, and cross-tenant access denial. Report incomplete functionality.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://org-weave-trade.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e40a8edd-f3d2-4386-b4f9-5207b09e9d64).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
