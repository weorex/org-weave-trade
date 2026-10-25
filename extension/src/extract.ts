// This function is injected only when the user presses Capture page.
// Keep it self-contained: Chrome serializes the function, not its imports.
export function extractAccessiblePage() {
  const visible = (element: Element) => {
    const style = getComputedStyle(element)
    return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0 && !element.closest('[hidden],[aria-hidden="true"]')
  }
  const text = (element: Element | null) => element && visible(element) ? (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 1000) : ''
  const links = Array.from(document.querySelectorAll('a[href]')).filter(visible)
  const emails = [...new Set(links.filter(a => a.getAttribute('href')?.startsWith('mailto:')).map(a => (a.getAttribute('href') ?? '').slice(7).split('?')[0] ?? ''))].slice(0, 50)
  const phones = [...new Set(links.filter(a => a.getAttribute('href')?.startsWith('tel:')).map(a => (a.getAttribute('href') ?? '').slice(4)))].slice(0, 50)
  const url = new URL(location.href); url.search = ''; url.hash = ''; url.username = ''; url.password = ''
  const tables = Array.from(document.querySelectorAll('table')).filter(visible).slice(0, 20).map((table, index) => {
    const rows = Array.from(table.querySelectorAll('tr')).filter(visible).slice(0, 201).map(row => Array.from(row.querySelectorAll('th,td')).slice(0, 30).map(text))
    return { name: text(table.querySelector('caption')) || `Table ${index + 1}`, headers: rows[0] ?? [], rows: rows.slice(1) }
  })

  // ---- Products ----
  const PRODUCT_HEADERS = ['SKU', 'Name', 'Description', 'Price', 'Link']
  const clean = (value: string, max: number) => value.replace(/\s+/g, ' ').trim().slice(0, max)
  const slugOf = (href: string) => { try { return new URL(href, location.href).pathname.split('/').filter(Boolean).at(-1)?.slice(0, 80) ?? '' } catch { return '' } }
  // A product's own page: skip anchors, category/tag/cart/account pages, shared call-to-action pages
  // (contact, quote…) and add-to-cart style actions.
  const SKIP_PATH = /\/(product-category|product-tag|product_cat|categor(y|ies)|tags?|collections?|brands?|cart|basket|checkout|wishlist|compare|my-account|account|login|signin|sign-in|register|signup|search|contact(-us)?|quotes?|request-a-quote|get-a-quote|enquiry|inquiry|about(-us)?|faqs?)(\/|$)/i
  const rawUrl = (anchor: Element) => {
    const raw = anchor.getAttribute('href')
    if (!raw || raw.startsWith('#') || /^(mailto|tel|javascript):/i.test(raw)) return ''
    try {
      const target = new URL(raw, location.href)
      if (!/^https?:$/.test(target.protocol) || SKIP_PATH.test(target.pathname) || /add[-_]to[-_](cart|wishlist)|wishlist|compare/i.test(target.search)) return ''
      if (target.origin === location.origin && target.pathname.replace(/\/$/, '') === location.pathname.replace(/\/$/, '')) return ''
      return target.origin + target.pathname
    } catch { return '' }
  }
  const chrome = 'header,nav,footer,[role="navigation"],[role="banner"],[role="contentinfo"],.menu,.breadcrumb,.breadcrumbs'
  // A destination linked from many places is a shared button (e.g. "Enquire"), not one product's page.
  // A product is typically linked 1–3 times (image, title, button).
  const linkCounts = new Map<string, number>()
  document.querySelectorAll('a[href]').forEach(anchor => { if (anchor.closest(chrome)) return; const target = rawUrl(anchor); if (target) linkCounts.set(target, (linkCounts.get(target) ?? 0) + 1) })
  const detailUrl = (anchor: Element) => { const target = rawUrl(anchor); return target && (linkCounts.get(target) ?? 0) <= 4 ? target : '' }
  const urlCache = new Map<Element, string[]>()
  const detailUrls = (element: Element) => {
    let found = urlCache.get(element)
    if (!found) { found = [...new Set(Array.from(element.querySelectorAll('a[href]')).map(detailUrl).filter(Boolean))]; urlCache.set(element, found) }
    return found
  }

  // 1. Known card markup: schema.org microdata and common shop themes (WooCommerce, Shopify, generic).
  const known = '[itemtype*="schema.org/Product"],.product-card,[data-product],[data-product-id],li.product,.type-product,.product-item,.grid-product,.product-grid-item,.product-miniature,.card-product,.product-tile'
  const candidates = new Set<Element>(Array.from(document.querySelectorAll(known)))
  // 2. Generic repeated cards: from each image/heading, climb to the largest block that still points to
  //    a single product page; blocks repeated as siblings with the same structure are product cards.
  const signature = (element: Element) => element.tagName + '.' + Array.from(element.classList).filter(c => !/\d|active|current|first|last|odd|even|hover|selected/i.test(c)).sort().join('.')
  const groups = new Map<Element, Map<string, Set<Element>>>()
  Array.from(document.querySelectorAll('img,h2,h3,h4,h5,[class*="title"],[class*="price"]')).slice(0, 3000).forEach(start => {
    if (start.closest(chrome)) return
    let node: Element = start; let parent = node.parentElement
    while (parent && parent !== document.body && detailUrls(parent).length <= 1) { node = parent; parent = node.parentElement }
    if (!parent || detailUrls(node).length !== 1) return
    const bySignature = groups.get(parent) ?? new Map<string, Set<Element>>(); groups.set(parent, bySignature)
    const members = bySignature.get(signature(node)) ?? new Set<Element>(); bySignature.set(signature(node), members); members.add(node)
  })
  groups.forEach(bySignature => bySignature.forEach(members => { if (members.size >= 2) members.forEach(member => candidates.add(member)) }))
  // A candidate pointing to several product pages is a list container, not a card. Among nested
  // candidates for the same product, keep the outermost (most complete) block.
  const cards = Array.from(candidates).filter(card => visible(card) && !card.closest(chrome) && detailUrls(card).length <= 1)
  const outermost = cards.filter(card => !cards.some(other => other !== card && other.contains(card)))

  const firstText = (card: Element, selector: string, max: number) => { for (const element of Array.from(card.querySelectorAll(selector))) { const value = clean(text(element), max); if (value) return value } return '' }
  const attribute = (card: Element, names: string[]) => { for (const name of names) { const value = card.getAttribute(name) ?? card.querySelector(`[${name}]`)?.getAttribute(name); if (value?.trim()) return clean(value, 80) } return '' }
  const CURRENCY = /(?:[₹$€£¥]|Rs\.?|INR|USD|EUR|GBP|AED)\s?\d[\d,.]*(?:\s?[–-]\s?(?:[₹$€£¥]|Rs\.?)?\s?\d[\d,.]*)?/i
  const priceOf = (card: Element) => {
    const element = card.querySelector('[itemprop="price"],.price,.product-price,.price-item,.money,[class*="price"]')
    if (element && visible(element)) {
      const content = element.getAttribute('content')
      // Drop screen-reader-only duplicates ("Price range: … through …").
      const copy = element.cloneNode(true) as Element; copy.querySelectorAll('.screen-reader-text,.sr-only,.visually-hidden').forEach(e => e.remove())
      const value = clean(copy.textContent ?? '', 100) || (content ? clean(content, 40) : '')
      if (value) return value
    }
    return (card.textContent ?? '').match(CURRENCY)?.[0]?.trim() ?? ''
  }
  const seen = new Set<string>()
  const cardRows = outermost.map(card => {
    const anchors = Array.from(card.querySelectorAll('a[href]')).filter(a => detailUrl(a))
    // Prefer the link around the image or title; fall back to the card's only product URL.
    const primary = anchors.find(a => a.querySelector('img,h1,h2,h3,h4,h5,h6')) ?? anchors[0]
    const link = primary ? detailUrl(primary) : ''
    const name = firstText(card, '[itemprop="name"],.woocommerce-loop-product__title,.product-title,.product-name,.product__title,.card__heading,[class*="product-title"],[class*="product-name"],h1,h2,h3,h4,h5,h6', 160)
      || clean(primary ? text(primary) : '', 160) || clean(card.querySelector('img[alt]')?.getAttribute('alt') ?? '', 160)
    const price = priceOf(card)
    const sku = firstText(card, '[itemprop="sku"],.sku,[class*="sku"]', 80).replace(/^sku:?\s*/i, '') || attribute(card, ['data-sku', 'data-product_sku', 'data-product-sku']) || (link ? slugOf(link) : '')
    const description = firstText(card, '[itemprop="description"],.woocommerce-product-details__short-description,.product-short-description,[class*="description"],[class*="excerpt"],p', 300)
    return [sku, name, description && description !== name && description !== price ? description : '', price, link]
  }).filter(row => {
    const key = row[4] || `${row[0]}|${row[1]}`
    if (!row[1] || seen.has(key)) return false
    seen.add(key); return true
  }).slice(0, 200)

  // 3. schema.org product metadata the page publishes for search engines (JSON-LD). Only Product and
  //    product ItemList entries are read; no other script content. Often lists items not yet shown on screen.
  const structured: string[][] = []; const structuredSeen = new Set<string>()
  const str = (v: unknown) => typeof v === 'string' || typeof v === 'number' ? clean(String(v), 1000) : ''
  const types = (o: Record<string, unknown>) => ([] as unknown[]).concat(o['@type']).map(String)
  const addProduct = (p: Record<string, unknown>, href: unknown = p['url'], name: unknown = p['name']) => {
    const offers = (Array.isArray(p['offers']) ? p['offers'][0] : p['offers']) as Record<string, unknown> | undefined
    const link = typeof href === 'string' ? href : ''
    const row = [str(p['sku']) || str(p['mpn']) || str(p['productID']) || slugOf(link), str(name), str(p['description']).slice(0, 300), offers ? [str(offers['priceCurrency']), str(offers['price'] ?? offers['lowPrice'])].filter(Boolean).join(' ') : '', link]
    const key = row[4] || `${row[0]}|${row[1]}`
    if (row[1] && !structuredSeen.has(key) && structured.length < 200) { structuredSeen.add(key); structured.push(row) }
  }
  const walk = (node: unknown, depth: number): void => {
    if (!node || typeof node !== 'object' || depth > 8) return
    if (Array.isArray(node)) { node.forEach(n => walk(n, depth + 1)); return }
    const o = node as Record<string, unknown>; const t = types(o)
    if (t.includes('BreadcrumbList')) return
    if (t.includes('Product')) addProduct(o)
    else if (t.includes('ListItem')) { const item = o['item']; if (!(item && typeof item === 'object' && types(item as Record<string, unknown>).includes('Product')) && (o['url'] || typeof item === 'string')) addProduct({}, o['url'] ?? item, o['name']) }
    Object.values(o).forEach(v => walk(v, depth + 1))
  }
  document.querySelectorAll('script[type="application/ld+json"]').forEach(script => { try { walk(JSON.parse(script.textContent ?? ''), 0) } catch { /* ignore malformed metadata */ } })

  // Distinguish repeated names (e.g. freeze-dried vs dehydrated variants) using the product slug.
  for (const rows of [structured, cardRows]) rows.forEach(row => { if (rows.filter(other => other[1] === row[1]).length > 1 && /^[a-z0-9-]+$/.test(row[0] ?? '')) row[1] = (row[0] ?? '').replace(/-+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) })
  // Product tables first (largest first) so the popup opens on the most complete list.
  const productTables = [
    { name: `Products on page (${cardRows.length})`, headers: PRODUCT_HEADERS, rows: cardRows },
    { name: `Products from page data (${structured.length})`, headers: PRODUCT_HEADERS, rows: structured },
  ].filter(t => t.rows.length).sort((a, b) => b.rows.length - a.rows.length)
  return { sourceUrl: url.href, title: document.title.slice(0, 160), company: text(document.querySelector('h1')) || document.title.slice(0, 160), address: text(document.querySelector('address')), emails, phones, tables: [...productTables, ...tables] }
}
