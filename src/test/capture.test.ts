import { describe, it, expect } from 'vitest'
import { captureRequest, cleanSourceUrl, extensionRedirect, mapProductRows, combineCaptureProducts, captureSessionUsable } from '../services/capture-schemas'
import { extractAccessiblePage } from '../../extension/src/extract'
import { readFileSync } from 'node:fs'

describe('Explicit capture privacy and validation', () => {
  it('accepts manually entered products without an HTML table', () => {
    expect(combineCaptureProducts([], [{ sku:'LEAD-001', name:'Steel fastener', unit:'box' }])).toEqual([{ sku:'LEAD-001', name:'Steel fastener', unit:'box', category:'', description:'', status:'active' }])
    expect(() => combineCaptureProducts([], [{ sku:'', name:'Steel fastener' }])).toThrow()
  })
  it('uses edited table cells and only selected rows', () => {
    expect(mapProductRows([['EDIT-001','Edited product'],['IGNORE','Not selected']], {sku:0,name:1}, [0])[0]?.sku).toBe('EDIT-001')
    expect(mapProductRows([], {}, [])).toEqual([])
  })
  it('retains only usable short-lived capture connections', () => {
    expect(captureSessionUsable({token:'capture-only',expires:900}, 899000)).toBe(true)
    expect(captureSessionUsable({token:'capture-only',expires:900}, 900000)).toBe(false)
    expect(captureSessionUsable(undefined)).toBe(false)
  })
  it('removes credentials, queries and fragments from source URLs', () => { expect(cleanSourceUrl('https://user:secret@example.com/company?token=secret#contact')).toBe('https://example.com/company'); expect(() => cleanSourceUrl('chrome://extensions')).toThrow() })
  it('accepts only the shipped extension callback', () => { expect(extensionRedirect('https://mlnkikhebcdilmbihjlgbjedmnbjamgc.chromiumapp.org/')).not.toBeNull(); expect(extensionRedirect('https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.chromiumapp.org/')).toBeNull(); expect(extensionRedirect('https://mlnkikhebcdilmbihjlgbjedmnbjamgc.chromiumapp.org/?redirect=https://evil.test')).toBeNull() })
  it('maps only selected rows and requires valid SKU/name', () => { expect(mapProductRows([['A','One'],['B','Two']], { sku:0,name:1 }, [1])).toEqual([{ sku:'B',name:'Two',category:'',description:'',unit:'piece',status:'active' }]); expect(() => mapProductRows([['','One']], { sku:0,name:1 }, [0])).toThrow() })
  it('bounds selected products to 200 and contacts to 50', () => { const base = { organizationId:'d0000000-0000-4000-8000-000000000001',typeId:'d0000000-0000-4000-8000-000000000002',version:1,requestId:'d0000000-0000-4000-8000-000000000003',sourceUrl:'https://example.com',values:{ name:'Example' } }; expect(captureRequest.safeParse({ ...base,products:Array.from({ length:201 }, () => ({ sku:'A',name:'One' })) }).success).toBe(false); expect(captureRequest.safeParse({ ...base,contacts:Array.from({ length:51 }, () => ({ name:'Person' })) }).success).toBe(false) })
  it('has minimal permissions and no automatic collection', () => { const manifest = JSON.parse(readFileSync('extension/manifest.json','utf8')); expect(manifest.manifest_version).toBe(3); expect(manifest.permissions.sort()).toEqual(['activeTab','identity','scripting','storage']); expect(manifest.host_permissions).toEqual(['https://org-weave-trade.lovable.app/*']); expect(manifest.content_scripts).toBeUndefined(); expect(manifest.background).toBeUndefined() })
  it('revokes inherited capture privileges', () => { const sql=readFileSync('drizzle/migrations/0011_restrict_capture_client_grants.sql','utf8'); expect(sql).toContain('REVOKE ALL ON public.data_captures FROM anon,authenticated'); expect(sql).toContain('GRANT SELECT,INSERT ON public.data_captures TO authenticated') })
  it('does not extract hidden DOM or form passwords', () => {
    document.body.innerHTML='<h1>Public company</h1><a href="mailto:public@example.com">Contact</a><a hidden href="mailto:hidden@example.com">Private</a><input type="password" value="secret"><table><tr><th>SKU</th><th>Name</th></tr><tr><td>P1</td><td>Public product</td></tr></table>'
    const original = Element.prototype.getClientRects
    Element.prototype.getClientRects = function() { return { length:this.hasAttribute('hidden') ? 0 : 1 } as DOMRectList }
    try { const result = extractAccessiblePage(); expect(result.company).toBe('Public company'); expect(result.emails).toEqual(['public@example.com']); expect(result.tables[0]?.rows).toEqual([['P1','Public product']]); expect(JSON.stringify(result)).not.toContain('secret') } finally { Element.prototype.getClientRects = original }
  })
})