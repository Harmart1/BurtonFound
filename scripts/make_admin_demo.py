"""Create an offline read-only-owner-workflow demo using FICTIONAL example data.
Never copy the demo into public/ during deployment."""
from pathlib import Path
from bs4 import BeautifulSoup
import json
root=Path(__file__).resolve().parent.parent
web=root/'public'
soup=BeautifulSoup((web/'admin/orders.html').read_text(),'html.parser')
style=soup.new_tag('style');style.string=(web/'admin/admin.css').read_text()
soup.head.append(style)
for link in soup.find_all('link',href=True):
 if 'stylesheet' in link.get('rel',[]) or 'icon' in link.get('rel',[]):link.decompose()
for s in soup.find_all('script',src=True):s.decompose()
notice=soup.new_tag('div');notice['style']='background:#70272d;color:#fff;text-align:center;padding:12px;font:700 14px system-ui;position:relative;z-index:1';notice.string='OWNER DASHBOARD DEMO · Fictional orders only · No live customer data, payment or shipping';soup.body.insert(0,notice)
order={'id':'3d715cc7-2707-447b-86da-3856dd6e88ba','created_at':'2026-11-05T10:15:00Z','email':'collector@example.test','customer_name':'Example Collector','item_lines':[{'sku':'OH-003','title':'Marlene Dietrich · Studio-Style Portrait','price_cents':3995},{'sku':'CC-010','title':'Your Host of the Airwaves','price_cents':3995}], 'subtotal_cents':7990,'shipping_cents':1495,'total_cents':9485,'shipping_address':{'name':'Example Collector','address':{'line1':'10 Fictional Avenue','city':'Ottawa','state':'ON','postal_code':'K1A 0B1','country':'CA'}},'fulfillment_status':'processing','payment_status':'paid','carrier':'','tracking_number':''}
startup=f'''<script>window.BURTON_ACCOUNT={{init:()=>Promise.resolve(),authToken:()=>Promise.resolve('offline-demo-token')}};
const EXAMPLE_ORDERS={json.dumps([order])};
window.fetch=async (url,opts={{}})=>{{
 const u=String(url);
 if(u.includes('/api/admin/orders'))return new Response(JSON.stringify({{orders:EXAMPLE_ORDERS}}),{{status:200,headers:{{'Content-Type':'application/json'}}}});
 if(u.includes('/api/admin/holds'))return new Response(JSON.stringify({{holds:[{{id:'5a39b6de-a319-4730-ace1-23a364cf7785',item_skus:['OH-002'],stripe_session_id:'cs_test_example_fake',status:'reserved',created_at:'2026-11-05T11:00:00Z'}}]}}),{{status:200}});
 if(u.includes('/api/admin/reconcile-hold'))return new Response(JSON.stringify({{released:false,message:'Demo only — no actual Stripe verification was attempted'}}),{{status:200}});
 if(u.includes('/api/admin/fulfillment-history'))return new Response(JSON.stringify({{events:[]}}),{{status:200}});
 if(u.includes('/api/admin/fulfill')){{const x=JSON.parse(opts.body);Object.assign(EXAMPLE_ORDERS[0],{{fulfillment_status:x.status,carrier:x.carrier,tracking_number:x.tracking_number}});return new Response(JSON.stringify({{ok:true,order:EXAMPLE_ORDERS[0]}}),{{status:200}})}}
 return new Response(JSON.stringify({{error:'Not available in offline demo'}}),{{status:503}})
}};
</script>'''
bootstrap=BeautifulSoup(startup,'html.parser').script;soup.body.append(bootstrap)
script=soup.new_tag('script');script.string=(web/'admin/admin.js').read_text();soup.body.append(script)
output=root/'Burton_And_Found_Shipping_Dashboard_Demo.html';output.write_text(str(soup),encoding='utf-8')
print('Created',output,output.stat().st_size)
