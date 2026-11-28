// Fail-closed guard for preview deployments. No network or secret access.
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export const expectedPreviewVars=Object.freeze({
 OWNER_TEST_CHECKOUT_ENABLED:'true',
 LIVE_CHECKOUT_ENABLED:'false',
 STRIPE_WEBHOOK_MODE:'test',
 LIVE_PAYMENTS_APPROVED:'false',
 PHYSICAL_STOCK_APPROVED:'false',
 DOMESTIC_POSTAGE_VERIFIED:'false',
 CUSTOMER_EMAIL_DELIVERY_APPROVED:'false',
 SELLER_TERMS_APPROVED:'false',
 PRODUCTION_WEBHOOK_READY:'false',
 STRIPE_PAYOUTS_VERIFIED:'false',
 TAX_CONFIGURATION_APPROVED:'false',
 CARRIER_QUOTES_ENABLED:'false',
 CANADA_POST_PRODUCTION_VERIFIED:'false',
 FEDEX_PRODUCTION_VERIFIED:'false',
 US_SHIPPING_APPROVED:'false',
 CANADA_POST_US_DUTIES_APPROVED:'false',
 STRIPE_AUTOMATIC_TAX:'false',
 MARKETING_INDEXING_APPROVED:'false',
 CANADA_POST_TEST_APP:'true',
 FEDEX_SANDBOX:'true',
 SHIPPING_MODE:'flat_rate',
 // Owner approved these exact provisional prices; this does not authorize checkout.
 FLAT_RATE_PRICES_APPROVED:'true',
 SHIPPING_STANDARD_CA_CENTS:'1995',
 SHIPPING_EXPRESS_CA_CENTS:'3495',
 SHIPPING_STANDARD_US_CENTS:'2995',
 SHIPPING_EXPRESS_US_CENTS:'4995',
 LIVE_APPROVED_SKUS_JSON:'[]',
 SHIPPING_ALLOWED_COUNTRIES:'CA'
});
export function assertPreviewRelease(config){
 const vars=config?.vars;
 const wrong=Object.entries(expectedPreviewVars).filter(([k,v])=>vars?.[k]!==v).map(([k])=>k);
 if(wrong.length)throw Error('Preview release refused: missing or unsafe settings: '+wrong.join(', '));
 if(config?.name!=='burtonfound')throw Error('Preview release refused: wrong Worker name');
 return true;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{assertPreviewRelease(JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8')));
 console.log('PASS: expected Worker and all preview-only safety settings verified.');}
 catch(e){console.error(e.message);process.exitCode=1;}
}
