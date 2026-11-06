"""Make a separate self-contained offline account UI preview. No backend, no real account created."""
from pathlib import Path
from bs4 import BeautifulSoup
from io import BytesIO
from PIL import Image
import base64,mimetypes,re
root=Path(__file__).resolve().parent.parent/'public'
soup=BeautifulSoup((root/'account.html').read_text(encoding='utf8'),'html.parser')
# Remove unsupported external share metadata
for el in soup.select('link[rel=preload]'):el.decompose()
images={}
for p in sorted((root/'assets').rglob('*')):
 if not p.is_file() or p.suffix.lower() not in ('.svg','.png','.webp','.jpg','.jpeg'):continue
 rel=p.relative_to(root).as_posix()
 if p.suffix.lower() in ('.webp','.jpg','.jpeg'):
  im=Image.open(p).convert('RGB');im.thumbnail((480,660));buf=BytesIO();im.save(buf,format='WEBP',quality=65,method=2)
  images[rel]='data:image/webp;base64,'+base64.b64encode(buf.getvalue()).decode()
 else:
  images[rel]='data:'+ (mimetypes.guess_type(str(p))[0] or 'image/png')+';base64,'+base64.b64encode(p.read_bytes()).decode()
for node in list(soup.select('link[rel=stylesheet]')):
 f=root/node['href'];css=f.read_text()
 def swap(m):
  path=m.group(1).strip('"\' ')
  candidate=(f.parent/path).relative_to(root).as_posix() if not path.startswith(('data:','http')) else path
  return 'url("'+images.get(candidate,path)+'")'
 css=re.sub(r'url\(([^)]+)\)',swap,css)
 style=soup.new_tag('style');style.string=css;node.replace_with(style)
for node in list(soup.select('script[src]')):
 f=root/node['src']
 if not f.is_file():continue
 script=soup.new_tag('script');script.string=f.read_text().replace('</script','<\\/script');node.replace_with(script)
for node in soup.select('img[src]'):
 if node.get('src') in images:node['src']=images[node['src']]
for node in soup.select('link[rel=icon]'):
 if node.get('href') in images:node['href']=images[node['href']]
for a in soup.select('a[href^="index.html"]'):
 a['href']=a['href'].replace('index.html','BurtonFound-Dark-Contrast-Preview.html',1)
for a in soup.select('a[href="account.html#signin"],a[href="account.html#signup"]'):
 a['href']=a['href'].replace('account.html','',1)
# In offline previews, no credentials/payment are ever collected as real accounts.
bar=soup.new_tag('div',attrs={'id':'offlineAccountsDisclaimer','role':'note','style':'background:#23463b;color:#fffdfa;padding:13px 18px;text-align:center;font:700 13px/1.5 system-ui;position:static'})
bar.string='COLLECTOR ACCOUNT PREVIEW · Sign-in and registration forms are shown but cannot create real accounts until Supabase is connected'
soup.body.insert(0,bar)
soup.title.string='Burton & Found | Account sign-in and registration preview'
out=Path('/mnt/data/BurtonFound-Account-Contrast-Preview.html');out.write_text(str(soup),encoding='utf8');print('Account preview',out,'bytes',out.stat().st_size)
