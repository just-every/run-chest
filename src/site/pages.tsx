import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { contractPageHtml } from '../base/contract-page'
import { runPageHtml, siteNotFoundHtml, type SiteBuild, type SiteContext } from '../base/run-site'
import { identity } from '../identity'
import { DocsArticle } from './docs/DocsArticle'
import { DocsIndex } from './docs/DocsIndex'
import { docsHead, docsPages } from './docs/pages'
import { iconLinks, socialImage, withChestIcons } from './head'
import { Landing } from './landing/Landing'
import { run } from './run'
import './shell/site.css'

/**
 * The run site (run-chest.com), written by `rer build --site`: the landing at `/`, whose Run Chest opens the Run page at
 * `/run`; the docs at `/docs` and `/docs/<slug>`, rendered from docs/site.json and docs/*.md; and the not-found page.
 * Every page is static, needs no script and links no instance-only route. The installed app's `/` is the Lobby.
 */
export function sitePages({ styles, contract }: SiteContext): SiteBuild {
  const document = ({ title, description, path }: { title: string; description: string; path: string }, body: ReactElement) => '<!doctype html>' + renderToStaticMarkup(
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="theme-color" content="#fcfcff" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Chest" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={`${identity.runSite}${path}`} />
        <meta property="og:image" content={socialImage} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        {iconLinks.map(link => <link key={link.href} {...link} />)}
        <link rel="preload" href="/fonts/inter/inter-latin-opsz-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="stylesheet" href={identity.theme} />
        {styles.map(href => <link key={href} rel="stylesheet" href={href} />)}
      </head>
      <body className="site">{body}</body>
    </html>,
  )
  return {
    pages: [
      { path: '/', html: document({ title: 'Chest · Every file, where it should be', description: identity.tagline, path: '/' }, <Landing />) },
      { path: '/run', html: withChestIcons(runPageHtml(identity, run, contract)) },
      ...(contract ? [{ path: '/contract', html: withChestIcons(contractPageHtml(identity, run, contract)) }] : []),
      { path: '/docs', html: document({ ...docsHead(), path: '/docs' }, <DocsIndex />) },
      ...docsPages.filter(page => page.slug).map(page => ({ path: `/docs/${page.slug}`, html: document({ ...docsHead(page.slug), path: `/docs/${page.slug}` }, <DocsArticle slug={page.slug} />) })),
      { path: '/404', html: withChestIcons(siteNotFoundHtml(identity, run, contract)) },
    ],
    assets: ['rer-theme.css', 'fonts', 'brand', 'site'],
  }
}
