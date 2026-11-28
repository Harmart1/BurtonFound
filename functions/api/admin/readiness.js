import {json,error,requireAdmin,db,stripe,secure,hasVerifiedPackages} from '../../_lib/core.js';

// Owner-only diagnostic. Whitelist every response field; never return credentials or customer PII.
export async function onRequestGet({request,env}){
  try{
    if(!await requireAdmin(request,env))return error(403,'Administrator access required');
    const [stock,tax]=await Promise.all([
      db(env,'bf_public_stock',{query:'?select=sku,available'}).catch(()=>null),
      /^sk_test_/.test(env.STRIPE_SECRET_KEY||'')
        ?stripe(env,'tax/settings',null,'GET').catch(()=>null)
        :Promise.resolve(null)
    ]);
    const flat=env.SHIPPING_MODE!=='live_carrier';
    const standardPrice=String(env.SHIPPING_STANDARD_CA_CENTS||'');
    const hasFlatRate=/^\d{1,6}$/.test(standardPrice)&&Number(standardPrice)>0&&env.FLAT_RATE_PRICES_APPROVED==='true';
    const rateValue=k=>{const value=String(env[k]||'');return /^\d{1,6}$/.test(value)&&Number(value)>0&&Number(value)<=500000?Number(value):null;};
    const flatRates={approved:env.FLAT_RATE_PRICES_APPROVED==='true',CA:{standard:rateValue('SHIPPING_STANDARD_CA_CENTS'),express:rateValue('SHIPPING_EXPRESS_CA_CENTS')},US:{standard:rateValue('SHIPPING_STANDARD_US_CENTS'),express:rateValue('SHIPPING_EXPRESS_US_CENTS')}};
    const liveCarrierConfigured=env.CARRIER_QUOTES_ENABLED==='true'
      &&String(env.SHIPPING_QUOTE_SECRET||'').length>=32
      &&hasVerifiedPackages(env)
      &&!!((env.CANADA_POST_API_MODE==='legacy'?(env.CANADA_POST_USERNAME&&env.CANADA_POST_PASSWORD):(env.CANADA_POST_CLIENT_ID&&env.CANADA_POST_CLIENT_SECRET))
        ||(env.FEDEX_CLIENT_ID&&env.FEDEX_CLIENT_SECRET&&env.FEDEX_ACCOUNT_NUMBER));
    const taxState=tax?.status==='active'?'active':tax?.status==='pending'?'pending':'unknown';
    const missingTaxFields=Array.isArray(tax?.status_details?.pending?.missing_fields)
      ?tax.status_details.pending.missing_fields.filter(x=>typeof x==='string').slice(0,12)
      :[];
    return json({
      checkout:secure(env)?String(env.STRIPE_SECRET_KEY).startsWith('sk_test_')?'test_mode':'live_mode':'preview_only',
      supabase:{connected:!!env.SUPABASE_SECRET_KEY&&Array.isArray(stock),listings:Array.isArray(stock)?stock.length:null,available:Array.isArray(stock)?stock.filter(x=>x.available===true).length:null},
      stripe:{sandboxKeyPresent:/^sk_test_/.test(env.STRIPE_SECRET_KEY||''),webhookSigningKeyPresent:/^whsec_/.test(env.STRIPE_WEBHOOK_SECRET||''),expectedMerchantConfigured:/^acct_[A-Za-z0-9]{10,64}$/.test(env.STRIPE_EXPECTED_ACCOUNT_ID||''),taxSettings:taxState,missingTaxFields},
      shipping:{mode:flat?'flat_rate':'live_carrier',flatRates,configured:flat?hasFlatRate:liveCarrierConfigured,allowedCountries:String(env.SHIPPING_ALLOWED_COUNTRIES||'CA').split(',').map(x=>x.trim()).filter(Boolean),canadaPost:{mode:env.CANADA_POST_API_MODE==='legacy'?'legacy_xml':'json_oauth',credentialsPresent:env.CANADA_POST_API_MODE==='legacy'?!!(env.CANADA_POST_USERNAME&&env.CANADA_POST_PASSWORD):!!(env.CANADA_POST_CLIENT_ID&&env.CANADA_POST_CLIENT_SECRET),productionRatesVerified:env.CANADA_POST_PRODUCTION_VERIFIED==='true',testApp:env.CANADA_POST_TEST_APP==='true'},fedex:{credentialsPresent:!!(env.FEDEX_CLIENT_ID&&env.FEDEX_CLIENT_SECRET&&env.FEDEX_ACCOUNT_NUMBER),productionRatesVerified:env.FEDEX_PRODUCTION_VERIFIED==='true',sandbox:env.FEDEX_SANDBOX==='true'},crossBorderCheckoutApproved:env.US_SHIPPING_APPROVED==='true',canadaPostUsDutiesApproved:env.CANADA_POST_US_DUTIES_APPROVED==='true',verifiedPackagesAvailable:hasVerifiedPackages(env)},
      approvals:{taxApproved:env.TAX_CONFIGURATION_APPROVED==='true',checkoutEnabled:env.LIVE_CHECKOUT_ENABLED==='true',livePaymentApproved:env.LIVE_PAYMENTS_APPROVED==='true',payoutsVerifiedByOwner:env.STRIPE_PAYOUTS_VERIFIED==='true',physicalStockApproved:env.PHYSICAL_STOCK_APPROVED==='true',domesticPostageVerified:env.DOMESTIC_POSTAGE_VERIFIED==='true',customerEmailDeliveryApproved:env.CUSTOMER_EMAIL_DELIVERY_APPROVED==='true',sellerTermsApproved:env.SELLER_TERMS_APPROVED==='true',productionWebhookReady:env.PRODUCTION_WEBHOOK_READY==='true'},
      email:{deliveryVerifiedByApp:false,notice:'Check allowed redirect URLs and real confirmation/reset email delivery in Supabase before customer launch'}
    });
  }catch(e){
    console.error('Readiness check failed',e?.message||'unknown');
    return error(503,'Launch readiness unavailable');
  }
}
