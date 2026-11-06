"""Burton & Found robust lightweight single-file preview.

Every referenced product image is embedded ONCE at compact display resolution.
No relative scripts, styles, images, APIs or external libraries are required.
This is a customer-facing *demo*, never a payments page.
"""
from pathlib import Path
from bs4 import BeautifulSoup
from io import BytesIO
from PIL import Image,ImageOps
import base64, json, mimetypes, re

root=Path(__file__).resolve().parent.parent/'public'
assert (root/'index.html').is_file()
soup=BeautifulSoup((root/'index.html').read_text(encoding='utf-8'),'html.parser')

# Remove server-only metadata, preload and any network-dependence from standalone copy.
for element in list(soup.select('link[rel="preload"]')):element.decompose()
for element in list(soup.select('meta[property="og:image"]')):element.decompose()

image_data={}
for path in sorted((root/'assets').rglob('*')):
    if not path.is_file():continue
    rel=path.relative_to(root).as_posix()
    if path.suffix.lower()=='.webp':
        im=Image.open(path).convert('RGB')
        im.thumbnail((440,670),Image.Resampling.LANCZOS)
        buffer=BytesIO()
        im.save(buffer,format='WEBP',quality=60,method=1)
        content='data:image/webp;base64,'+base64.b64encode(buffer.getvalue()).decode('ascii')
    elif path.suffix.lower() in ('.svg','.png','.jpg','.jpeg'):
        mime=mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
        if path.suffix.lower() in ('.jpg','.jpeg'):
            im=Image.open(path).convert('RGB')
            im.thumbnail((600,400),Image.Resampling.LANCZOS)
            buffer=BytesIO();im.save(buffer,'WEBP',quality=60,method=1)
            content='data:image/webp;base64,'+base64.b64encode(buffer.getvalue()).decode('ascii')
        else:content='data:'+mime+';base64,'+base64.b64encode(path.read_bytes()).decode('ascii')
    else:continue
    image_data[rel]=content

# Bundle existing CSS in original cascading order.
for link in list(soup.select('link[rel="stylesheet"]')):
    f=root/link.get('href','')
    if not f.is_file():raise FileNotFoundError(f)
    css=f.read_text('utf-8')
    def inlineurl(match):
        path=match.group(1).strip().strip('"\'')
        resolved=(f.parent/path).relative_to(root).as_posix() if not path.startswith('data:') and not path.startswith('http') else path
        return 'url("'+image_data.get(resolved,path)+'")'
    css=re.sub(r'url\(([^)]+)\)',inlineurl,css)
    style=soup.new_tag('style')
    style.string=css
    link.replace_with(style)

# Provide fictitious quotes via in-page API interception, keeping the existing
# cart/shipping interface functional with no actual external requests.
mock=(Path(__file__).parent/'demo-shipping.js').read_text('utf-8')
mock=mock.replace('Illustrative tracked service · not a live quote','Tracked standard · example only').replace('Illustrative express service · not a live quote','Express · example only')
mockscript=soup.new_tag('script');mockscript.string=mock;soup.head.insert(0,mockscript)

# Link user-visible image tags directly to inlined previews.
for node in soup.select('img[src]'):
    k=node['src']
    if not k:continue
    if k in image_data:node['src']=image_data[k]
    elif not k.startswith(('data:','https:','http:')):raise RuntimeError(f'Unembedded image {k}')
for link in soup.select('link[rel="icon"]'):
    if link.get('href') in image_data:link['href']=image_data[link['href']]

# Fill background-image inline styles when present.
for el in soup.select('[style]'):
    for k,v in image_data.items():
        if k in el['style']:el['style']=el['style'].replace(k,v)

# Replace imported scripts IN THEIR EXISTING ORDER. The product-image mapping
# occurs immediately after products.js so all downstream UI code sees data URLs.
for script in list(soup.select('script[src]')):
    f=root/script['src']
    if not f.is_file():raise FileNotFoundError(f)
    code=f.read_text('utf-8')
    if f.name=='products.js':
        code+='\n'+'''(()=>{
          const images=window.__BF_IMAGES;
          const fix=(data)=>{
            if(!data||typeof data!== 'object')return data;
            if(Array.isArray(data)){for(let i=0;i<data.length;i++)data[i]=fix(data[i]);return data}
            for(const k of Object.keys(data)){
              const v=data[k];data[k]=(typeof v==='string'&&images[v])?images[v]:fix(v);
            }
            return data;
          };
          fix(window.BURTON_DATA);
          delete window.__BF_IMAGES;
        })();'''
        # Single embedded asset table, NOT repeated 5-10x across inventory/archive objects.
        code='window.__BF_IMAGES='+json.dumps(image_data,separators=(',',':'))+';\n'+code
    new=soup.new_tag('script')
    new.string=code.replace('</script','<\\/script')
    script.replace_with(new)

# Clear demos / mock API to avoid a false impression of live processing.
bar=soup.new_tag('div',id='offlineReviewNotice')
bar['style']='background:#23463b;color:#fffdfa;padding:10px 16px;text-align:center;font:700 13px/1.5 system-ui,sans-serif;position:static;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap'
bar.append('BURTON & FOUND · Interactive offline preview · Shipping prices and dates are examples · No real payments or accounts')
btn=soup.new_tag('button',id='tryShippingDemo',type='button')
btn['style']='min-height:44px;border:2px solid #fdf5e8;border-radius:6px;background:#fdf5e8;color:#19352b;font:700 13px system-ui;padding:9px 14px;cursor:pointer'
btn.string='Try shipping choices';bar.append(btn)
soup.body.insert(0,bar)
notice=soup.new_tag('style');notice.string='#setupNotice{display:none!important}';soup.head.append(notice)
js=r'''(()=>{const start=()=>{const btn=document.getElementById('tryShippingDemo');if(!btn)return;btn.addEventListener('click',()=>{
 window.BURTON_STORE_API?.setBag?.(['CC-010']);document.getElementById('cartOpen')?.click();
 const form=document.getElementById('shippingForm');if(form){form.elements.country.value='CA';form.elements.postal.value='P6A 1Z1';form.elements.city.value='Sault Ste. Marie';form.elements.state.value='ON';}
 });};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();})();'''
last=soup.new_tag('script');last.string=js;soup.body.append(last)

# Standalone main preview links to matching standalone account preview.
for account_link in soup.select('a[href^="account.html"]'):
    account_link['href']=account_link['href'].replace('account.html','BurtonFound-Account-Contrast-Preview.html',1)

# Heading makes it clear this file does not require a separate HTTP server.
soup.title.string='Burton & Found | Readable Dark & Light Mode Preview'

out=Path('/mnt/data/BurtonFound-Dark-Contrast-Preview.html')
out.write_text(str(soup),encoding='utf-8')
print('FILE',out,'SIZE',out.stat().st_size,'IMAGE_ASSETS',len(image_data))
assert out.stat().st_size<3000000,'still too large for preview'

# Ensure no unresolved dependency references outside the embedded data.
text=out.read_text()
checks={'external_css':len(soup.select('link[rel="stylesheet"]')),'external_scripts':len(soup.select('script[src]')),
        'external_images':len([x for x in soup.select('img[src]') if x['src'] and not x['src'].startswith('data:')]),
        'assets_table_bytes':sum(len(v) for v in image_data.values())}
print('DEPENDENCIES',checks)
assert all(checks[k]==0 for k in ('external_css','external_scripts','external_images'))
