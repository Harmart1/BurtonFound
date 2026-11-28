"""Verify explicitly approved public indexing; no search submissions or mutations."""
import json,sys,subprocess
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
from xml.etree import ElementTree as ET
BASE="https://burtonandfound.ca"
ROOT=Path("public")
PRIVATE=["/account","/admin/orders","/checkout-success","/preview"]
class Metadata(HTMLParser):
    def __init__(self,html):
        super().__init__();self.canonical=[];self.robots=[];self.feed(html)
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=="link" and a.get("rel")=="canonical":self.canonical.append(a.get("href"))
        if tag=="meta" and a.get("name","").lower()=="robots":self.robots.append(a.get("content","").lower())
def require(ok,message):
    if not ok:raise ValueError(message)
def urls(xml):
    result=[x.text for x in ET.fromstring(xml).findall("{*}url/{*}loc")]
    require(len(result)==239 and len(set(result))==239,"Unexpected public sitemap size")
    require(sum("/products/" in u for u in result)==229,"Wrong product count")
    for u in result:
        p=urlsplit(u)
        require(u.startswith(BASE+"/") and not p.query and not p.fragment and not p.path.endswith(".html"),"Noncanonical public URL")
        require(not any(p.path.startswith(x) for x in PRIVATE+["/api/"]),"Private page in sitemap")
    return result
def metadata(html,url):
    m=Metadata(html)
    require(m.canonical==[url],"Wrong canonical: "+url)
    require(len(m.robots)==1 and "noindex" not in m.robots[0] and "nofollow" not in m.robots[0] and "index" in m.robots[0],"Indexing blocked: "+url)
def local():
    found=urls((ROOT/"sitemap.xml").read_text())
    for url in found:
        p=urlsplit(url).path
        f=ROOT/("index.html" if p=="/" else p.lstrip("/")+".html")
        metadata(f.read_text(),url)
    for p in PRIVATE:
        m=Metadata((ROOT/(p.lstrip("/")+".html")).read_text())
        require(any("noindex" in x for x in m.robots),"Private page not noindex: "+p)
    print("PASS local: 239 canonical public pages, 229 product pages, private pages excluded.")
def get(url):
    r=subprocess.run(["curl","--fail","--silent","--show-error","--max-time","20","--write-out","\\n%{http_code}",url],capture_output=True,timeout=25)
    require(r.returncode==0,"Public request failed: "+url)
    body,code=r.stdout.rsplit(b"\n",1)
    require(code==b"200","Noncanonical response at "+url+" HTTP "+code.decode())
    return body.decode()
def live():
    found=urls(get(BASE+"/sitemap.xml"))
    robots=get(BASE+"/robots.txt")
    require("Sitemap: "+BASE+"/sitemap.xml" in robots and "Disallow: /admin/" in robots and "Disallow: /api/" in robots and "Disallow: /account" in robots,"Unexpected robots policy")
    sample=[BASE+"/",BASE+"/vintage-cars",BASE+"/collections/automobiles",BASE+"/collections/hollywood",BASE+"/collections/coca-cola",BASE+"/gifts/vintage-gifts-for-collectors"]
    for prefix in ("va-","bf-va-set","oh-","cc-"):
        candidates=[u for u in found if "/products/" in u and "-"+prefix in u]
        require(bool(candidates),"Missing collection products: "+prefix)
        sample.append(candidates[0])
    for url in sample:
        metadata(get(url),url)
        print("PASS live indexable canonical: "+url)
    for p in PRIVATE:
        m=Metadata(get(BASE+p))
        require(any("noindex" in x for x in m.robots),"Private page not noindex: "+p)
    print("PASS live sitemap, robots, representative pages and noindex on private pages.")
if __name__=="__main__":
    try:(live if "--live" in sys.argv else local)()
    except (ValueError,FileNotFoundError) as e:sys.exit(str(e))
    except Exception:sys.exit("Search readiness verification failed; no external submissions made.")
