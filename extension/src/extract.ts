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
  const cards = Array.from(document.querySelectorAll('[itemtype*="Product"],.product-card,[data-product]')).filter(visible).slice(0, 200).map(card => [text(card.querySelector('[itemprop="sku"],[data-sku]')), text(card.querySelector('[itemprop="name"],h2,h3')), text(card.querySelector('[itemprop="description"]'))])
  if (cards.length) tables.push({ name: 'Products', headers: ['SKU', 'Name', 'Description'], rows: cards })
  return { sourceUrl: url.href, title: document.title.slice(0, 160), company: text(document.querySelector('h1')) || document.title.slice(0, 160), address: text(document.querySelector('address')), emails, phones, tables }
}