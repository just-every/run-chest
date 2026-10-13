import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import { fontLinks } from '../base/font-head'
import { pageStyle } from '../base/page-style'
import { introGuardScript, introCss } from '../base/hydration/intro-guard'
import { HydrationUnit } from '../base/hydration/unit'

export const Route = createRootRoute({
  head: () => ({ meta: [{ charSet: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }], title: 'Chest' }),
  notFoundComponent: () => <HydrationUnit><h1>Not found</h1></HydrationUnit>,
  component: () => <html lang="en"><head>
    <script dangerouslySetInnerHTML={{ __html: introGuardScript }} />
    <style>{introCss}</style>
    {fontLinks.map(link => <link key={link.href} {...link} />)}
    <link rel="stylesheet" href="/rer-theme.css" />
    <HeadContent />
    <style>{pageStyle}</style>
  </head><body><Outlet /><Scripts /></body></html>,
})
