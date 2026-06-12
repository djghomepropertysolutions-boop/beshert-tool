import { useState, useEffect, useRef, useMemo, Component } from "react";

// ── Embedded Logos ────────────────────────────────────────────────────────────
const ROOFING_LOGO = "/beshert-logo.jpg";
const CHURCH_LOGO  = "/magnanimous-logo.png";

// ── Brand Colors ──────────────────────────────────────────────────────────────
const PURPLE       = "#7B6FA0";
const PURPLE_LIGHT = "#ece9f4";
const PURPLE_DARK  = "#5a4f7a";
const HEADER_BG    = "#8b7cb4";
const NAVY         = "#1a2744";
const GOLD         = "#C9A84C";
const WHITE        = "#ffffff";
const TEXT         = "#1e1e2e";

// ── Company Contact Info ───────────────────────────────────────────────────────
const COMPANY = {
  office:  "(216) 326-ROOF",
  officeNum: "2163267663",
  mobile:  "440-554-5332",
  email:   "beshert@thebeshertgroup.com",
  website: "www.thebeshertgroup.com",
};

// ── Default Staff Names ────────────────────────────────────────────────────────
const DEFAULT_PREPARED_BY = "Carlito";
const DEFAULT_PM          = "Bobby";

// ── Helpers ───────────────────────────────────────────────────────────────────
const today  = () => new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
const fmtAmt = (n)  => {
  const v = parseFloat(String(n).replace(/[^0-9.]/g,""));
  return isNaN(v) ? "$0.00" : "$" + v.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
};
const calcSplits = (total, split) => {
  if(split==="50/50") return [{label:"Deposit (50%)",amt:total*0.5},{label:"Balance Due (50%)",amt:total*0.5}];
  return [{label:"Deposit (33%)",amt:total*0.33},{label:"Progress Payment (33%)",amt:total*0.33},{label:"Final Payment (34%)",amt:total*0.34}];
};

// ── Payment Lines Helper (NEW) ────────────────────────────────────────────────
const getPaymentLines = (total, structure, split, customPmts) => {
  if(structure==="due_now") return [{label:"Total Due", amt:total}];
  if(structure==="custom") {
    const pmts = (customPmts||[]).filter(p=>p.label&&p.label.trim());
    if(pmts.length===0) return [{label:"Total Due", amt:total}];
    return pmts.map(p=>({label:p.label, amt:parseFloat(String(p.amount||"0").replace(/[^0-9.]/g,""))||0}));
  }
  return calcSplits(total, split);
};

// ── Hybrid Storage (Netlify API → localStorage fallback) ──────────────────────
const API = "/.netlify/functions/estimates";
const storage = {
  async save(est) {
    try {
      const r = await fetch(API, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(est),signal:AbortSignal.timeout(15000)});
      if (r.ok) return await r.json();
    } catch(e) {}
    const all = JSON.parse(localStorage.getItem("brrg_estimates")||"[]");
    const idx = all.findIndex(e=>e.contractNumber===est.contractNumber);
    if(idx>=0) all[idx]=est; else all.push(est);
    localStorage.setItem("brrg_estimates", JSON.stringify(all));
    return {success:true,local:true};
  },
  async list() {
    try {
      const r = await fetch(API+"?action=list",{signal:AbortSignal.timeout(15000)});
      if (r.ok) return await r.json();
    } catch(e) {}
    return JSON.parse(localStorage.getItem("brrg_estimates")||"[]");
  },
  async get(contractNum) {
    try {
      const r = await fetch(`${API}?action=get&contract=${contractNum}`,{signal:AbortSignal.timeout(15000)});
      if (r.ok) return await r.json();
    } catch(e) {}
    const all = JSON.parse(localStorage.getItem("brrg_estimates")||"[]");
    return all.find(e=>e.contractNumber===contractNum)||null;
  },
  async nextEstNum() {
    try {
      const r = await fetch(API+"?action=counter",{signal:AbortSignal.timeout(15000)});
      if (r.ok) { const {count}=await r.json(); return `BRRG-EST-${new Date().getFullYear()}-${String(count).padStart(3,"0")}`; }
    } catch(e) {}
    const yr = new Date().getFullYear();
    let count=1;
    try { const s=JSON.parse(localStorage.getItem("brrg_est_counter")||"null"); if(s&&s.year===yr) count=s.count+1; } catch(e) {}
    localStorage.setItem("brrg_est_counter",JSON.stringify({year:yr,count}));
    return `BRRG-EST-${yr}-${String(count).padStart(3,"0")}`;
  },
  async nextInvNum() {
    try {
      const r = await fetch(API+"?action=inv_counter",{signal:AbortSignal.timeout(15000)});
      if (r.ok) { const {count}=await r.json(); return `BRRG-INV-${new Date().getFullYear()}-${String(count).padStart(3,"0")}`; }
    } catch(e) {}
    const yr = new Date().getFullYear();
    let count=1;
    try { const s=JSON.parse(localStorage.getItem("brrg_inv_counter")||"null"); if(s&&s.year===yr) count=s.count+1; } catch(e) {}
    localStorage.setItem("brrg_inv_counter",JSON.stringify({year:yr,count}));
    return `BRRG-INV-${yr}-${String(count).padStart(3,"0")}`;
  }
};

// ── Job Types ─────────────────────────────────────────────────────────────────
const JOBS = {
  repair:{label:"Repair",icon:"🔧",color:"#e8a020",defaultSplit:"50/50",
    duration:"Approximately 1–3 working days (weather permitting).",
    warranty:["2-Year Workmanship/Labor Warranty (Contractor)","Manufacturer Material Warranty Applies","Extended Warranty Available upon request"],
    scope:["Stage job to meet OSHA regulations.","Identify and expose all damaged or leaking areas.","Remove damaged shingles, underlayment, and flashing as needed.","Install ice and water shield at all repair areas.","Install matching 30-year dimensional shingles.","Re-flash all affected penetrations and valleys as needed.","Seal all exposed nails and penetrations.","Install soil stack boots (neoprene) as applicable.","Clean up and haul away all debris."]},
  layover:{label:"Layover (Re-Roof)",icon:"🏠",color:"#3a7bd5",defaultSplit:"50/50",
    duration:"Approximately 3–5 working days (weather permitting). Start date to be scheduled upon material delivery and permit approval.",
    warranty:["10-Year Workmanship/Labor Warranty (Contractor)","10-Year Standard System Warranty","Optional Extended Manufacturer Warranty (15 Years): Available upon request"],
    scope:["Stage job to meet OSHA regulations and supply permits.","Inspect existing roof deck condition prior to installation.","Install new starter shingles along all eaves.","Install ice and water shield 3 feet up from all gutters, valleys, and protrusions.","Install synthetic roofing underlayment with cap nails.","Install 30-year dimensional shingles over existing layer.","Install new ridge cap and ridge vent.","Re-flash all penetrations, soil stack boots (neoprene), and protrusions.","Install counter flashing, step flashing, aprons, and splash guards.","Clean up and haul away all debris.","General liability, contractor bond, and city registration enclosed."]},
  tearoff:{label:"Tear-Off",icon:"🏗️",color:"#c0392b",defaultSplit:"33/33/34",
    duration:"Approximately 7–10 working days (weather permitting). Start date to be scheduled upon material delivery and permit approval.",
    warranty:["12-Year Workmanship/Labor Warranty (Contractor)","10-Year Manufacturer Material Warranty (Standard System Warranty)","Optional Extended Manufacturer Warranty (15–20 Years): Available upon request"],
    scope:["Stage job to meet OSHA regulations and supply permits.","Tear off roof down to deck.","Replace any damaged decking as needed; billed separately at $4.50 per sq. ft.","Install synthetic roofing underlayment with cap nails.","Install shingle valleys. Optional: Install metal valleys (additional cost).","Install ice and water shield 3 feet up from all gutters, valleys, and protrusions.","Install 30-year dimensional shingles.","Install starter shingles and bleeders.","Install counter flashing, step flashing, aprons, and splash guards.","Install ridge vent.","Clean up and haul away all debris.","Provide on-site Safety Coordinator, Project Manager, and sidewalk/traffic protection.","Install soil stack boots (neoprene).","Any flat roof areas will be roofed with SBS modified granulated material.","General liability, contractor bond, and city registration enclosed."]},
  commercial:{label:"Commercial TPO/EPDM",icon:"🏢",color:"#27ae60",defaultSplit:"33/33/34",
    duration:"Approximately 10–15 working days (weather permitting). Start date to be scheduled upon material delivery and permit approval.",
    warranty:["12-Year Workmanship/Labor Warranty (Contractor)","15-Year NDL Manufacturer System Warranty","Optional Extended Manufacturer Warranty (20 Years): Available upon request"],
    scope:["Stage job to meet OSHA regulations and supply permits.","Remove existing roofing membrane and insulation down to structural deck.","Inspect and replace damaged decking or insulation as needed; billed separately.","Install tapered ISO insulation board for positive drainage.","Install TPO/EPDM membrane (60-mil standard).","Heat-weld/adhere all field seams per manufacturer specifications.","Flash and seal all penetrations, HVAC curbs, drains, and perimeter edges.","Install metal edge termination, coping, and perimeter detail.","Install walkway pads at all roof access points.","Pressure test all seams and penetrations prior to completion.","Clean up and haul away all debris.","Provide on-site Safety Coordinator and Project Manager.","General liability, contractor bond, and city registration enclosed."]},
  gutters:{label:"Gutters / Soffit",icon:"🌧️",color:"#8e44ad",defaultSplit:"50/50",
    duration:"Approximately 2–4 working days (weather permitting).",
    warranty:["15-Year Workmanship/Labor Warranty","Standard Manufacturer Material Warranty Applies","Extended Warranty Available upon request"],
    scope:["Install .027 gauge aluminum gutter and downspout.","Install new vinyl soffit including rake edges.","Replace any rotted fascia board as needed; billed separately at $3.70/LF.","Clean up and haul away all debris (applies to entire home gutters)."]},
  siding:{label:"Siding",icon:"🏗",color:"#2980b9",defaultSplit:"50/50",
    duration:"Approximately 3–5 working days (weather permitting).",
    warranty:["15-Year Workmanship/Labor Warranty","Standard Manufacturer Material Warranty Applies","Extended Warranty Available upon request"],
    scope:["Remove and dispose of existing siding.","Install moisture barrier / house wrap.","Install new siding per specifications.","Install all necessary trim, J-channel, and accessories.","Caulk and seal all penetrations and openings.","Clean up and haul away all debris."]}
};

// ── Legal Content ─────────────────────────────────────────────────────────────
const STANDARD_PROVISIONS = [
  {id:"sp1",title:"Unforeseen Conditions & Additional Costs",text:"While every effort is made to accurately assess project scope, unforeseen conditions may arise once work begins, including hidden damage, structural issues, or code compliance requirements, that could not be reasonably identified prior to project start. Should such circumstances occur, the contractor will promptly notify the client, and any necessary additional work or materials will be subject to a written change order outlining revised costs and timelines. All change orders must be approved in writing prior to execution. No additional work will proceed without documented client authorization."},
  {id:"sp2",title:"Delays Beyond Control (Force Majeure)",text:"The contractor shall not be held liable for delays or inability to complete work due to causes beyond their reasonable control, including but not limited to inclement weather, supply chain disruptions, labor disputes, government restrictions, or acts of God. In such events, the project schedule may be extended without penalty to either party. The contractor will maintain communication and provide revised timelines as conditions evolve."},
  {id:"sp3",title:"Worksite Conditions & Access",text:"The client agrees to provide clear and safe access to the worksite. The contractor is not responsible for delays or damages caused by restricted access, unsafe conditions, or third-party interference."},
  {id:"sp4",title:"Cleanup & Completion Standards",text:"The contractor will maintain a clean and orderly worksite and perform final cleanup upon completion. Minor debris or dust may remain consistent with industry standards."},
  {id:"sp5",title:"Liability & Property Protection",text:"The contractor maintains appropriate insurance coverage. While reasonable precautions are taken, the contractor is not responsible for pre-existing conditions or concealed structural issues."}
];
const BUYERS_RIGHT = {id:"br1",title:"Buyer's Right to Cancel · Ohio Home Solicitation Sales Act",text:"The Buyer has the right to cancel this Agreement, without any penalty or obligation, by midnight of the third business day after the date the Buyer signs this Agreement. Cancellation must be made in writing and delivered or sent to the Contractor at the address or email listed in this Agreement. If the Buyer cancels within this period, any payments made will be returned in accordance with applicable law."};
const EXCLUSIONS = ["Permits, testing, or engineering fees not included unless specified.","No hazardous material (e.g., asbestos) abatement is included.","Price includes minor decking repairs; major deck replacement will be quoted separately if needed.","Electrical disconnection/reconnection of rooftop units, if required, to be handled by others.","Project pricing based on clear site access and normal working hours."];

// ── Print CSS ─────────────────────────────────────────────────────────────────
const printCSS = `@media print{body *{visibility:hidden!important}#print-area,#print-area *{visibility:visible!important}#print-area{position:absolute!important;left:0!important;top:0!important;width:100%!important}@page{margin:0.5in}}`;
const mobileCSS = `@media(max-width:700px){
  .grid-4{grid-template-columns:1fr 1fr!important}
  .grid-3{grid-template-columns:1fr 1fr!important}
  .grid-2{grid-template-columns:1fr!important}
  .top-bar-btns{flex-wrap:wrap!important;gap:6px!important}
  input,select,textarea{font-size:16px!important}
  button{min-height:40px!important}
}`;

// ── Shared Styles ─────────────────────────────────────────────────────────────
const S = {
  app:     {fontFamily:"Georgia,'Times New Roman',serif",background:"#f0eef7",minHeight:"100vh",color:TEXT},
  card:    {background:WHITE,borderRadius:10,padding:"22px 24px",marginBottom:18,boxShadow:"0 2px 8px rgba(90,79,122,0.10)"},
  label:   {display:"block",fontSize:11,fontWeight:700,color:PURPLE_DARK,textTransform:"uppercase",letterSpacing:1,marginBottom:5},
  input:   {width:"100%",padding:"9px 12px",borderRadius:6,border:"1.5px solid #d1c9e8",fontSize:13,fontFamily:"Georgia,serif",color:TEXT,boxSizing:"border-box",outline:"none"},
  btn:     (bg,fg="#fff")=>({background:bg,color:fg,border:"none",borderRadius:7,padding:"10px 22px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"Georgia,serif",letterSpacing:.5}),
  stepBtn: (active)=>({padding:"8px 18px",borderRadius:20,fontSize:12,fontWeight:700,cursor:"pointer",border:`2px solid ${active?HEADER_BG:"#d1c9e8"}`,background:active?HEADER_BG:WHITE,color:active?WHITE:PURPLE,fontFamily:"Georgia,serif",marginRight:6,marginBottom:6}),
  tag:     (c)=>({background:c+"22",color:c,border:`1px solid ${c}44`,borderRadius:4,padding:"2px 8px",fontSize:11,fontWeight:700}),
};

// ── Add-On Library (NEW) ──────────────────────────────────────────────────────
const ADDON_LIB_KEY = "brrg_addon_library";
const loadAddonLib  = () => { try { return JSON.parse(localStorage.getItem(ADDON_LIB_KEY)||"[]"); } catch(e){ return []; } };
const saveToAddonLib = (text) => {
  if(!text||!text.trim()) return;
  const lib = loadAddonLib();
  if(!lib.some(l=>l.toLowerCase()===text.trim().toLowerCase())) lib.push(text.trim());
  localStorage.setItem(ADDON_LIB_KEY, JSON.stringify(lib));
};
const MATERIAL_LIB_KEY = "brrg_material_library";
const DRAFT_KEY        = "brrg_draft";
const STATUS_OPTIONS   = ["Pending","Approved","Scheduled","In Progress","Invoiced","Paid"];
const STATUS_COLORS    = {Pending:"#e67e22",Approved:"#27ae60",Scheduled:"#3498db","In Progress":"#8e44ad",Invoiced:"#2980b9",Paid:"#159c59"};
const loadMaterialLib  = () => {try{return JSON.parse(localStorage.getItem(MATERIAL_LIB_KEY)||"[]");}catch(e){return[];}};
const saveMaterialLib  = (text) => {if(!text||!text.trim())return;const lib=loadMaterialLib();if(!lib.some(l=>l.toLowerCase()===text.trim().toLowerCase()))lib.push(text.trim());localStorage.setItem(MATERIAL_LIB_KEY,JSON.stringify(lib));};

// ═══════════════════ DOCUMENT SUB-COMPONENTS ════════════════════════════════

function DocHeader({roofingLogo,churchLogo,docDate,label}) {
  return (
    <div style={{background:HEADER_BG,color:WHITE,padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",borderRadius:"6px 6px 0 0"}}>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        {roofingLogo
          ? <img src={roofingLogo} alt="BEshert" style={{height:54,objectFit:"contain",background:WHITE,borderRadius:4,padding:3}}/>
          : <div style={{height:54,width:84,background:"rgba(255,255,255,0.15)",borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"rgba(255,255,255,0.5)"}}>LOGO</div>}
        <div>
          <div style={{fontWeight:700,fontSize:13,letterSpacing:1}}>BESHERT ROOFING REDEVELOPMENT GROUP</div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.75)",letterSpacing:2}}>MAGNANIMOUS LIFE · 501(C)(3) · EST. 2005</div>
          <div style={{marginTop:4}}><span style={{fontSize:14,fontWeight:800,color:GOLD,letterSpacing:1}}>📞 {COMPANY.office}</span><span style={{fontSize:9,color:"rgba(255,255,255,0.5)",marginLeft:8}}>📱 {COMPANY.mobile} · ✉ {COMPANY.email}</span></div>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:18,fontWeight:700,letterSpacing:2,color:GOLD}}>{label}</div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.65)",marginTop:2}}>{docDate}</div>
        </div>
        {churchLogo
          ? <img src={churchLogo} alt="Magnanimous Life" style={{height:54,objectFit:"contain",background:WHITE,borderRadius:4,padding:3}}/>
          : <div style={{height:54,width:54,background:"rgba(255,255,255,0.15)",borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"rgba(255,255,255,0.5)"}}>LOGO</div>}
      </div>
    </div>
  );
}

function ContactBlock() {
  return (
    <div style={{background:NAVY,color:WHITE,padding:"16px 20px",borderBottom:`2px solid ${PURPLE_LIGHT}`}}>
      <div style={{fontWeight:700,fontSize:11,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:12}}>Questions? Contact Us</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div style={{marginBottom:10}}><span style={{color:"rgba(255,255,255,0.5)",fontSize:11}}>📞 Office: </span><span style={{fontWeight:800,fontSize:16,color:GOLD,letterSpacing:1}}>{COMPANY.office}</span></div>
        {[["📱 Mobile",COMPANY.mobile],["✉ Email",COMPANY.email],["🌐 Website",COMPANY.website]].map(([lbl,val])=>(
          <div key={lbl} style={{fontSize:12.5}}>
            <span style={{color:"rgba(255,255,255,0.5)",marginRight:6}}>{lbl}:</span>
            <span style={{fontWeight:600,color:WHITE}}>{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DocFooter() {
  return (
    <div style={{background:NAVY,color:WHITE,padding:"7px 20px",fontSize:10,textAlign:"center",letterSpacing:1.5,borderRadius:"0 0 6px 6px"}}>
      ISSUED BY BESHERT, A QUALIFIED 501(C)(3) NONPROFIT ORGANIZATION · {COMPANY.website}
    </div>
  );
}

function Watermark({churchLogo}) {
  if(!churchLogo) return null;
  return (
    <>
      <style>{`@media print{#beshert-watermark{position:fixed!important;top:50%!important;left:50%!important;transform:translate(-50%,-50%) rotate(-25deg)!important;width:65%!important;opacity:0.10!important;z-index:9999!important;pointer-events:none!important;}}`}</style>
      <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,pointerEvents:"none",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
        <img id="beshert-watermark" src={churchLogo} alt="" style={{width:"70%",opacity:0.10,objectFit:"contain",transform:"rotate(-25deg)",userSelect:"none",pointerEvents:"none"}}/>
      </div>
    </>
  );
}

function ContractBadge({contractNumber,isRevised}) {
  if(!contractNumber) return null;
  return (
    <div style={{display:"flex",justifyContent:"flex-end",alignItems:"center",gap:6,padding:"5px 16px",background:"rgba(26,39,68,0.06)",borderBottom:`1px solid ${PURPLE_LIGHT}`}}>
      <span style={{fontSize:9.5,color:"#888",textTransform:"uppercase",letterSpacing:1}}>Contract No.</span>
      <span style={{background:NAVY,color:GOLD,padding:"3px 10px",borderRadius:4,fontSize:10.5,fontWeight:700,fontFamily:"monospace",letterSpacing:1,WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}}>{contractNumber}</span>
      {isRevised&&<span style={{background:"#e8a020",color:NAVY,fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:3,letterSpacing:1}}>REVISED</span>}
      <span style={{fontSize:9,color:"#aaa",marginLeft:4}}>Keep for your records</span>
    </div>
  );
}

// ── ProposalPreview (MODIFIED) ────────────────────────────────────────────────
function ProposalPreview({roofingLogo,churchLogo,docDate,docType,client,job,preparedBy,pm,scopeItems,finalPages,totalPrice,priceDesc,optItems,paymentSplit,contractNumber,linkedContract,isRevised,additionalJobs,paymentStructure,customPayments,signature,signatureTimestamp,signatureIP,status,measurements,materials,isInsuranceJob,insFields}) {
  const addJobsTotal = (additionalJobs||[]).reduce((s,j)=>s+(parseFloat(String(j.price||"0").replace(/[^0-9.]/g,""))||0),0);
  const grandTotal   = totalPrice + addJobsTotal;
  const addonTotal   = (optItems||[]).filter(o=>o.includeInTotal&&parseFloat(o.price)>0).reduce((s,o)=>s+parseFloat(o.price),0);
  const withTotal    = grandTotal + addonTotal;
  const hasAddons    = addonTotal > 0;
  const hasExtraJobs = (additionalJobs||[]).length > 0;
  const finalTotalForPayment = hasAddons ? withTotal : grandTotal;
  const payLines = getPaymentLines(finalTotalForPayment, paymentStructure||"split", paymentSplit, customPayments);
  const baseSplits = calcSplits(totalPrice, paymentSplit);
  const activeFP   = (finalPages||[]).filter(fp=>fp.on);
  const label      = docType==="invoice" ? "INVOICE" : "ESTIMATE";

  return (
    <div id="print-area" style={{position:"relative",maxWidth:820,margin:"0 auto",fontFamily:"Georgia,serif",fontSize:13,color:TEXT}}>
      <style>{`@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}#print-area{max-width:100%;}}`}</style>
      {docType==="invoice" && status==="Paid" && (
        <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none",zIndex:200,overflow:"hidden"}}>
          <div style={{border:"7px solid rgba(21,156,89,0.65)",color:"rgba(21,156,89,0.65)",fontSize:80,fontWeight:900,transform:"rotate(-32deg)",letterSpacing:6,padding:"8px 18px",borderRadius:10,lineHeight:1}}>PAID</div>
        </div>
      )}
      <Watermark churchLogo={churchLogo}/>
      <div style={{position:"relative",zIndex:1}}>
        <DocHeader roofingLogo={roofingLogo} churchLogo={churchLogo} docDate={docDate} label={label}/>
        <ContractBadge contractNumber={contractNumber} isRevised={isRevised}/>

        {linkedContract && (
          <div style={{background:"#f0f4ff",padding:"8px 20px",fontSize:11,color:"#444",borderBottom:`1px solid ${PURPLE_LIGHT}`}}>
            RE: Estimate Contract No. <strong>{linkedContract}</strong>
          </div>
        )}

        {/* Client + Job Info */}
        <div style={{background:WHITE,padding:"18px 20px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,borderBottom:`2px solid ${PURPLE_LIGHT}`}}>
          <div>
            <div style={{fontWeight:700,fontSize:11,color:PURPLE_DARK,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Prepared For</div>
            {/* CHANGE 1: Title inline with name */}
            <div style={{fontWeight:700}}>{client.title ? `${client.title} ${client.name}` : client.name}</div>
            {client.company && <div style={{fontSize:12}}>{client.company}</div>}
            <div style={{fontSize:12}}>{client.address}</div>
            <div style={{fontSize:12}}>{client.city}{client.state?`, ${client.state}`:""} {client.zip}</div>
            {client.phone && <div style={{fontSize:12}}>📞 {client.phone}</div>}
            {client.email && <div style={{fontSize:12}}>✉ {client.email}</div>}
          </div>
          <div>
            <div style={{fontWeight:700,fontSize:11,color:PURPLE_DARK,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Project Details</div>
            <table style={{fontSize:12,width:"100%",borderCollapse:"collapse"}}>
              <tbody>
                {[["Job Type",job.label],["Prepared By",preparedBy||"—"],["Project Manager",pm||"—"],["Est. Duration",job.duration],["Date",docDate]].map(([k,v])=>(
                  <tr key={k}><td style={{color:"#888",paddingRight:10,paddingBottom:3,whiteSpace:"nowrap",verticalAlign:"top"}}>{k}</td><td style={{fontWeight:600}}>{v}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {measurements && (measurements.squares||measurements.pitch||measurements.layers||measurements.decking) && (
          <div style={{background:PURPLE_LIGHT,padding:"12px 20px",borderBottom:`2px solid ${PURPLE_DARK}`,borderLeft:`5px solid ${PURPLE_DARK}`}}>
            <div style={{fontWeight:700,fontSize:11,color:PURPLE_DARK,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>📐 Roof Measurements</div>
            <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
              {measurements.squares&&<div style={{fontSize:12.5}}><span style={{color:"#888"}}>Squares: </span><strong style={{fontSize:14,color:NAVY}}>{measurements.squares}</strong></div>}
              {measurements.pitch&&<div style={{fontSize:12.5}}><span style={{color:"#888"}}>Pitch: </span><strong style={{fontSize:14,color:NAVY}}>{measurements.pitch}</strong></div>}
              {measurements.layers&&<div style={{fontSize:12.5}}><span style={{color:"#888"}}>Layers: </span><strong style={{fontSize:14,color:NAVY}}>{measurements.layers}</strong></div>}
              {measurements.decking&&<div style={{fontSize:12.5}}><span style={{color:"#888"}}>Decking: </span><strong style={{fontSize:14,color:NAVY}}>{measurements.decking}</strong></div>}
            </div>
          </div>
        )}
        {/* Insurance Claim Info */}
        {isInsuranceJob && insFields && (
          <div style={{background:"#fff8e8",padding:"14px 20px",borderBottom:`2px solid #f0d080`,borderLeft:"4px solid #C9A84C"}}>
            <div style={{fontWeight:700,fontSize:11,color:"#7a5800",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>⚡ Insurance Claim Details</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,fontSize:11.5}}>
              {insFields.insurer&&<div><span style={{color:"#888"}}>Insurer: </span><strong>{insFields.insurer}</strong></div>}
              {insFields.claimNum&&<div><span style={{color:"#888"}}>Claim #: </span><strong>{insFields.claimNum}</strong></div>}
              {insFields.policyNum&&<div><span style={{color:"#888"}}>Policy #: </span><strong>{insFields.policyNum}</strong></div>}
              {insFields.adjuster&&<div><span style={{color:"#888"}}>Adjuster: </span><strong>{insFields.adjuster}</strong></div>}
              {insFields.dateOfLoss&&<div><span style={{color:"#888"}}>Date of Loss: </span><strong>{insFields.dateOfLoss}</strong></div>}
              {insFields.deductible&&<div><span style={{color:"#888"}}>Deductible: </span><strong>${insFields.deductible}</strong></div>}
              {insFields.acv&&<div><span style={{color:"#888"}}>ACV: </span><strong>${insFields.acv}</strong></div>}
              {insFields.rcv&&<div><span style={{color:"#888"}}>RCV: </span><strong>${insFields.rcv}</strong></div>}
              {insFields.depreciation&&<div><span style={{color:"#888"}}>Depreciation: </span><strong>${insFields.depreciation}</strong></div>}
              {insFields.supplementNum&&<div><span style={{color:"#888"}}>Supplement #: </span><strong>{insFields.supplementNum}</strong></div>}
            </div>
          </div>
        )}
        {/* Scope — Primary Job */}
        <div style={{background:WHITE,padding:"16px 20px",borderBottom:`2px solid ${PURPLE_LIGHT}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{borderLeft:`5px solid ${PURPLE_DARK}`,paddingLeft:12,color:NAVY,fontWeight:700,fontSize:13,letterSpacing:1}}>
              SCOPE OF WORK{hasExtraJobs ? ` — ${job.label}` : ""}
            </div>
            {hasExtraJobs && <span style={{fontWeight:700,fontSize:14,color:NAVY}}>{fmtAmt(totalPrice)}</span>}
          </div>
          <ul style={{margin:0,paddingLeft:20}}>
            {(scopeItems||[]).filter(s=>s.on).map(s=><li key={s.id} style={{marginBottom:5,fontSize:12.5}}>{s.text}</li>)}
          </ul>
        </div>

        {/* Scope — Additional Jobs (each with own scope) */}
        {(additionalJobs||[]).map((j,idx)=>{
          const jScopeItems = j.scopeItems||[];
          const jLabel = j.desc||JOBS[j.type]?.label||j.type;
          return (
            <div key={j.id||idx} style={{background:WHITE,padding:"16px 20px",borderBottom:`2px solid ${PURPLE_LIGHT}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{borderLeft:`5px solid ${PURPLE_DARK}`,paddingLeft:12,color:NAVY,fontWeight:700,fontSize:13,letterSpacing:1}}>
                  SCOPE OF WORK — {jLabel}
                </div>
                <span style={{fontWeight:700,fontSize:14,color:NAVY}}>{fmtAmt(j.price)}</span>
              </div>
              {jScopeItems.filter(s=>s.on).length>0
                ? <ul style={{margin:0,paddingLeft:20}}>{jScopeItems.filter(s=>s.on).map(s=><li key={s.id} style={{marginBottom:5,fontSize:12.5}}>{s.text}</li>)}</ul>
                : <div style={{fontSize:12,color:"#aaa",fontStyle:"italic"}}>No scope items specified for this job.</div>
              }
            </div>
          );
        })}

        {materials && materials.filter(m=>m.on).length>0 && (
          <div style={{background:WHITE,padding:"16px 20px",borderBottom:`2px solid ${PURPLE_LIGHT}`}}>
            <div style={{fontWeight:700,fontSize:11,color:PURPLE_DARK,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Materials Specified</div>
            <ul style={{margin:0,paddingLeft:20}}>{materials.filter(m=>m.on).map(m=><li key={m.id} style={{marginBottom:4,fontSize:12.5}}>{m.text}</li>)}</ul>
          </div>
        )}
        {/* Warranty */}
        <div style={{background:PURPLE_LIGHT,padding:"14px 20px",borderBottom:`2px solid ${PURPLE_LIGHT}`}}>
          <div style={{fontWeight:700,fontSize:11,color:PURPLE_DARK,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Warranty</div>
          {job.warranty.map((w,i)=><div key={i} style={{fontSize:12,marginBottom:3}}>✓ {w}</div>)}
        </div>

        {/* Exclusions */}
        <div style={{background:WHITE,padding:"14px 20px",borderBottom:`2px solid ${PURPLE_LIGHT}`}}>
          <div style={{fontWeight:700,fontSize:11,color:PURPLE_DARK,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Exclusions</div>
          {EXCLUSIONS.map((e,i)=><div key={i} style={{fontSize:12,marginBottom:3,color:"#555"}}>• {e}</div>)}
        </div>

        {/* Pricing — MODIFIED for multiple jobs */}
        <div style={{background:WHITE,padding:"16px 20px",borderBottom:`2px solid ${PURPLE_LIGHT}`}}>
          <div style={{borderLeft:`5px solid ${PURPLE_DARK}`,paddingLeft:12,color:NAVY,fontWeight:700,fontSize:13,letterSpacing:1,marginBottom:14}}>PRICING</div>
          {priceDesc && <div style={{fontSize:12.5,color:"#444",marginBottom:16,lineHeight:1.6}}>{priceDesc}</div>}

          {/* Job line items table when there are multiple jobs */}
          {hasExtraJobs && (
            <div style={{marginBottom:14}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5}}>
                <thead>
                  <tr style={{background:PURPLE_LIGHT}}>
                    <th style={{padding:"7px 12px",textAlign:"left",fontWeight:700,color:PURPLE_DARK,fontSize:11,textTransform:"uppercase",letterSpacing:1}}>Description</th>
                    <th style={{padding:"7px 12px",textAlign:"right",fontWeight:700,color:PURPLE_DARK,fontSize:11,textTransform:"uppercase",letterSpacing:1}}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{borderBottom:`1px solid ${PURPLE_LIGHT}`}}>
                    <td style={{padding:"8px 12px"}}>{job.label}</td>
                    <td style={{padding:"8px 12px",textAlign:"right",fontWeight:600}}>{fmtAmt(totalPrice)}</td>
                  </tr>
                  {(additionalJobs||[]).map((j,i)=>(
                    <tr key={j.id||i} style={{borderBottom:`1px solid ${PURPLE_LIGHT}`}}>
                      <td style={{padding:"8px 12px"}}>{j.desc||JOBS[j.type]?.label||j.type}</td>
                      <td style={{padding:"8px 12px",textAlign:"right",fontWeight:600}}>{fmtAmt(j.price)}</td>
                    </tr>
                  ))}
                  <tr style={{background:NAVY}}>
                    <td style={{padding:"9px 12px",fontWeight:700,color:WHITE,fontSize:13}}>Grand Total</td>
                    <td style={{padding:"9px 12px",textAlign:"right",fontWeight:700,color:GOLD,fontSize:13}}>{fmtAmt(grandTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Addon breakdown (when no extra jobs) */}
          {!hasExtraJobs && hasAddons && (
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:12}}>
              <div style={{border:`1px solid ${PURPLE_LIGHT}`,borderRadius:6,overflow:"hidden"}}>
                <div style={{background:PURPLE_LIGHT,padding:"7px 14px",fontWeight:700,fontSize:11,color:PURPLE_DARK,textTransform:"uppercase",letterSpacing:1}}>Base Contract</div>
                <div style={{padding:"10px 14px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:10,paddingBottom:8,borderBottom:`1px solid ${PURPLE_LIGHT}`}}>
                    <span style={{fontWeight:700,fontSize:13}}>Total</span>
                    <span style={{fontWeight:700,fontSize:13}}>{fmtAmt(totalPrice)}</span>
                  </div>
                  {baseSplits.map((s,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:12}}>
                      <span style={{color:"#666"}}>{s.label}</span>
                      <span style={{fontWeight:600}}>{fmtAmt(s.amt)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{border:`2px solid ${HEADER_BG}`,borderRadius:6,overflow:"hidden"}}>
                <div style={{background:HEADER_BG,padding:"7px 14px",fontWeight:700,fontSize:11,color:WHITE,textTransform:"uppercase",letterSpacing:1}}>With Selected Add-Ons</div>
                <div style={{padding:"10px 14px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:12}}>
                    <span style={{color:"#666"}}>Base</span><span>{fmtAmt(totalPrice)}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:12,color:"#27ae60"}}>
                    <span>Add-Ons</span><span>+ {fmtAmt(addonTotal)}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:10,paddingBottom:8,borderBottom:`1px solid ${PURPLE_LIGHT}`,fontWeight:700,fontSize:13}}>
                    <span>Total</span><span style={{color:HEADER_BG}}>{fmtAmt(withTotal)}</span>
                  </div>
                  {calcSplits(withTotal,paymentSplit).map((s,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:12}}>
                      <span style={{color:"#666"}}>{s.label}</span>
                      <span style={{fontWeight:600}}>{fmtAmt(s.amt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Simple total when no extra jobs and no addons */}
          {!hasExtraJobs && !hasAddons && (
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
              <table style={{fontSize:13,borderCollapse:"collapse",minWidth:260}}>
                <tbody>
                  <tr style={{background:PURPLE_LIGHT}}><td style={{padding:"7px 14px",fontWeight:700,color:PURPLE_DARK}}>Sub Total</td><td style={{padding:"7px 14px",textAlign:"right",fontWeight:700}}>{fmtAmt(totalPrice)}</td></tr>
                  <tr style={{background:HEADER_BG}}><td style={{padding:"8px 14px",fontWeight:700,color:WHITE,fontSize:14}}>Total Due</td><td style={{padding:"8px 14px",textAlign:"right",fontWeight:700,color:GOLD,fontSize:14}}>{fmtAmt(totalPrice)}</td></tr>
                </tbody>
              </table>
            </div>
          )}

          {optItems && optItems.length>0 && (
            <div style={{marginTop:8}}>
              <div style={{fontWeight:700,fontSize:11,color:PURPLE_DARK,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Optional Add-Ons</div>
              {optItems.map((o,i)=>(
                <div key={o.id} style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4,color:"#444"}}>
                  <span>• {o.text}</span>
                  {parseFloat(o.price)>0 && <span style={{fontWeight:600,color:o.includeInTotal?"#27ae60":"#888"}}>{fmtAmt(o.price)}{o.includeInTotal?" ✓ included":""}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment Schedule — MODIFIED for payment structure */}
        <div style={{background:WHITE,padding:"14px 20px",borderBottom:`2px solid ${PURPLE_LIGHT}`}}>
          <div style={{fontWeight:700,fontSize:11,color:PURPLE_DARK,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>
            Payment Schedule
            {paymentStructure==="split" && ` (${paymentSplit})`}
            {paymentStructure==="due_now" && " — Due in Full"}
            {paymentStructure==="custom" && " — Custom Terms"}
            {hasAddons && " — Based on Included Add-Ons"}
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            {payLines.map((s,i)=>(
              <div key={i} style={{flex:1,minWidth:140,background:PURPLE_LIGHT,borderRadius:6,padding:"10px 14px",borderLeft:`4px solid ${HEADER_BG}`}}>
                <div style={{fontSize:11,fontWeight:700,color:PURPLE_DARK}}>{s.label}</div>
                <div style={{fontSize:16,fontWeight:700,color:NAVY,marginTop:4}}>{fmtAmt(s.amt)}</div>
              </div>
            ))}
          </div>
        </div>

        <ContactBlock/>

        {/* Signature */}
        <div style={{background:WHITE,padding:"16px 20px",borderBottom:`2px solid ${PURPLE_LIGHT}`}}>
          <div style={{fontWeight:700,fontSize:11,color:PURPLE_DARK,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Acceptance & Authorization</div>
          <div style={{fontSize:11.5,color:"#555",marginBottom:14,fontStyle:"italic",lineHeight:1.6}}>By signing below, I confirm I have read and agree to the full scope of work, pricing, and payment terms described in this estimate. I authorize Beshert Roofing Redevelopment Group to perform the work.</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:30}}>
            <div>
              {signature
                ?<img src={signature} alt="Client Signature" style={{height:50,maxWidth:"100%",objectFit:"contain",marginBottom:4,display:"block"}}/>
                :<div style={{borderBottom:"1.5px solid #999",marginBottom:4,height:50,display:"flex",alignItems:"flex-end"}}><span style={{fontSize:10,color:"#ccc",marginBottom:2}}>Signature required</span></div>}
              <div style={{fontSize:11,color:"#666"}}>Client Signature</div>
              {signatureTimestamp&&<div style={{fontSize:9.5,color:"#888",marginTop:3,fontStyle:"italic"}}>✓ Digitally signed: {signatureTimestamp}</div>}
              {signatureIP&&<div style={{fontSize:9,color:"#aaa"}}>IP: {signatureIP}</div>}
              <div style={{borderBottom:"1.5px solid #ccc",marginTop:14,marginBottom:4,height:28}}/><div style={{fontSize:11,color:"#666"}}>Client Name (Print)</div>
              <div style={{borderBottom:"1.5px solid #ccc",marginTop:10,marginBottom:4,height:28}}/><div style={{fontSize:11,color:"#666"}}>Date</div>
            </div>
            <div>
              <div style={{borderBottom:"1.5px solid #999",marginBottom:4,height:50}}/><div style={{fontSize:11,color:"#666"}}>Authorized Contractor Signature</div>
              <div style={{borderBottom:"1.5px solid #ccc",marginTop:14,marginBottom:4,height:28}}/><div style={{fontSize:11,color:"#666"}}>Contractor Name (Print)</div>
              <div style={{borderBottom:"1.5px solid #ccc",marginTop:10,marginBottom:4,height:28}}/><div style={{fontSize:11,color:"#666"}}>Date</div>
            </div>
          </div>
        </div>

        {/* Legal Pages */}
        {activeFP.map(fp=>{
          const prov=STANDARD_PROVISIONS.find(sp=>sp.id===fp.id);
          if(prov) return (<div key={fp.id} style={{background:WHITE,padding:"14px 20px",borderBottom:`1px solid ${PURPLE_LIGHT}`}}><div style={{fontWeight:700,fontSize:11,color:PURPLE_DARK,marginBottom:6}}>{prov.title}</div><div style={{fontSize:11.5,color:"#444",lineHeight:1.6}}>{prov.text}</div></div>);
          if(fp.id==="br1") return (<div key="br1" style={{background:"#fff9ec",padding:"14px 20px",border:`1px solid ${GOLD}44`}}><div style={{fontWeight:700,fontSize:11,color:"#7a5800",marginBottom:6}}>{BUYERS_RIGHT.title}</div><div style={{fontSize:11.5,color:"#555",lineHeight:1.6}}>{BUYERS_RIGHT.text}</div></div>);
          return null;
        })}
        <DocFooter/>
      </div>
    </div>
  );
}

// ═════════════════════ MAIN COMPONENT ════════════════════════════════════════
function LOAPreview({roofingLogo,churchLogo,client,insFields,contractNumber,docDate,signature,signatureTimestamp,signatureIP}) {
  return (
    <div id="loa-area" style={{maxWidth:820,margin:"0 auto",fontFamily:"Georgia,serif",fontSize:12.5,color:"#1a1a2a",background:"#fff",position:"relative"}}>
      <Watermark churchLogo={churchLogo}/>
      <style>{`@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}#loa-area{max-width:100%;}}`}</style>
      {/* Header */}
      <div style={{background:"#1a2744",color:"#fff",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",borderRadius:"6px 6px 0 0"}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          {roofingLogo&&<img src={roofingLogo} alt="" style={{height:48,objectFit:"contain",background:"#fff",borderRadius:4,padding:3}}/>}
          <div>
            <div style={{fontWeight:700,fontSize:13,letterSpacing:1}}>BESHERT ROOFING REDEVELOPMENT GROUP</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.6)",letterSpacing:2}}>Affiliated with Magnanimous Life 501(c)(3) · A Trusted Choice Since 2005</div>
            <div style={{fontSize:11,color:"#C9A84C",fontWeight:700,marginTop:2}}>📞 (216) 326-ROOF · beshert@thebeshertgroup.com · www.thebeshertgroup.com</div>
          </div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:15,fontWeight:700,color:"#C9A84C",letterSpacing:1}}>LETTER OF AUTHORIZATION</div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.6)",marginTop:2}}>Third-Party Authorization to Communicate with Insurance Provider</div>
          <div style={{fontSize:9,color:"rgba(255,255,255,0.4)",marginTop:2}}>Transmit to insurance claims department via fax or email.</div>
        </div>
      </div>

      {/* TO block */}
      <div style={{background:"#f8f9fb",padding:"12px 20px",borderBottom:"1px solid #e2e8f0",fontSize:12}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
          {[["TO",insFields?.insurer||"_______________"],["FAX / EMAIL","_______________"],["ATTN","_______________"],["DATE SENT",docDate]].map(([lbl,val])=>(
            <div key={lbl}><div style={{fontSize:9,color:"#888",textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>{lbl}</div><div style={{fontWeight:600,borderBottom:"1px solid #ccc",paddingBottom:3}}>{val}</div></div>
          ))}
        </div>
        <div style={{fontSize:10,color:"#888",marginTop:8,fontStyle:"italic"}}>File with the claim referenced below. A fully executed copy is available upon request from Beshert's office: (216) 326-ROOF · beshert@thebeshertgroup.com</div>
      </div>

      {/* Policyholder & Claim */}
      <div style={{padding:"14px 20px",borderBottom:"2px solid #ece9f4"}}>
        <div style={{borderLeft:"4px solid #8b7cb4",paddingLeft:12,color:"#1a2744",fontWeight:700,fontSize:12,letterSpacing:1,marginBottom:12}}>POLICYHOLDER & CLAIM REFERENCE</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,fontSize:12}}>
          {[["Policyholder name",client?.name||""],["Policy number",insFields?.policyNum||""],["Claim number",insFields?.claimNum||""],["Date of loss",insFields?.dateOfLoss||""],["Property address (subject of claim)",`${client?.address||""}, ${client?.city||""}${client?.state?`, ${client.state}`:""}`],["Adjuster name",insFields?.adjuster||""]].map(([lbl,val])=>(
            <div key={lbl} style={{borderBottom:"1px solid #e2e8f0",paddingBottom:6}}>
              <div style={{fontSize:10,color:"#888",marginBottom:2}}>{lbl}</div>
              <div style={{fontWeight:600,minHeight:18}}>{val||<span style={{color:"#ccc"}}>_______________</span>}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Beshert Contact */}
      <div style={{padding:"14px 20px",borderBottom:"1px solid #e2e8f0",background:"#ece9f4"}}>
        <div style={{borderLeft:"4px solid #8b7cb4",paddingLeft:12,color:"#1a2744",fontWeight:700,fontSize:12,letterSpacing:1,marginBottom:10}}>BESHERT DESIGNATED CONTACT FOR THIS CLAIM</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,fontSize:12}}>
          {[["Name","Carlito"],["Company","Beshert Roofing Redevelopment Group"],["Office","(216) 326-ROOF"],["Mobile","440-554-5332"],["Email","beshert@thebeshertgroup.com"],["Website","www.thebeshertgroup.com"]].map(([lbl,val])=>(
            <div key={lbl}><span style={{color:"#888"}}>{lbl}: </span><strong>{val}</strong></div>
          ))}
        </div>
      </div>

      {/* Authorization text */}
      <div style={{padding:"14px 20px",borderBottom:"1px solid #e2e8f0"}}>
        <div style={{borderLeft:"4px solid #8b7cb4",paddingLeft:12,color:"#1a2744",fontWeight:700,fontSize:12,letterSpacing:1,marginBottom:10}}>AUTHORIZATION — PLEASE READ AND RETAIN</div>
        <div style={{fontSize:12,lineHeight:1.8,color:"#333"}}>
          I, <strong>{client?.name||"_________________________"}</strong>, the named policyholder on the account referenced above, hereby authorize and direct <strong>{insFields?.insurer||"_________________________"}</strong> (insurance company) to communicate directly with, release claim information to, and accept documentation from: <strong>Carlito · Beshert Roofing Redevelopment Group</strong> · (216) 326-ROOF · beshert@thebeshertgroup.com
        </div>
        <div style={{fontSize:12,lineHeight:1.8,color:"#333",marginTop:8}}>
          I expressly authorize Beshert Roofing Redevelopment Group to speak on my behalf regarding all matters related to the contents, status, scope, and documentation and physical condition findings related to the above-referenced insurance claim. This authorization specifically permits Beshert to:
        </div>
        <div style={{marginTop:8,paddingLeft:4}}>
          {["Speak directly with insurance representatives, adjusters, and supervisors on my behalf regarding the claim","Discuss the status, details, scope of loss, and findings of the claim identified above","Receive copies of adjuster reports, scope of loss documents, and Explanation of Benefits summaries","Submit estimates, inspection reports, photographs, and supplemental documentation in support of this claim","Schedule and coordinate property inspections with your adjuster or field representative","Request re-inspection or supervisory review if findings are disputed"].map((item,i)=>(
            <div key={i} style={{fontSize:12,color:"#333",marginBottom:4}}>✓ {item}</div>
          ))}
        </div>
      </div>

      {/* Authorization period + Notice */}
      <div style={{padding:"12px 20px",borderBottom:"1px solid #e2e8f0",background:"#fffbe8",borderLeft:"4px solid #C9A84C"}}>
        <div style={{fontSize:12,color:"#7a5800",lineHeight:1.7}}><strong>Authorization Period:</strong> This authorization is effective as of the date signed below and remains in effect through the earlier of: (a) written revocation delivered to Beshert Roofing Redevelopment Group; (b) completion of the approved scope of work at the property; or (c) <strong>12 months</strong> from the date of signing. It does not assign, transfer, or convey any insurance benefits, proceeds, or policy rights.</div>
      </div>
      <div style={{padding:"10px 20px",borderBottom:"2px solid #e2e8f0",background:"#f8f9fb"}}>
        <div style={{fontSize:11.5,color:"#555",lineHeight:1.7}}><strong>Notice to Insurer:</strong> This authorization does not grant Beshert Roofing Redevelopment Group authority to negotiate, settle, or accept payment on behalf of the policyholder, nor does it constitute an Assignment of Benefits. All claim decisions and payments remain under the policyholder's control.</div>
      </div>

      {/* Signature */}
      <div style={{padding:"16px 20px",borderBottom:"1px solid #e2e8f0"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:30}}>
          <div>
            <div style={{fontWeight:700,fontSize:11,color:"#8b7cb4",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Policyholder Signature</div>
            {signature?<img src={signature} alt="" style={{height:50,maxWidth:"100%",objectFit:"contain",marginBottom:4,display:"block"}}/>:<div style={{borderBottom:"1.5px solid #999",height:50,marginBottom:4}}/>}
            {signatureTimestamp&&<div style={{fontSize:9.5,color:"#888",fontStyle:"italic"}}>✓ Digitally signed: {signatureTimestamp}</div>}
            {signatureIP&&<div style={{fontSize:9,color:"#aaa"}}>IP: {signatureIP}</div>}
            <div style={{borderBottom:"1.5px solid #ccc",marginTop:12,marginBottom:4,height:28}}/><div style={{fontSize:11,color:"#666"}}>Print Name · Date</div>
            <div style={{marginTop:10,fontSize:11,color:"#666",fontStyle:"italic"}}>Date of Birth (for carrier identity verification):</div>
            <div style={{borderBottom:"1.5px solid #ccc",marginTop:6,marginBottom:4,height:28}}/><div style={{fontSize:10,color:"#aaa"}}>MM / DD / YYYY — SSN is not collected on this form.</div>
          </div>
          <div>
            <div style={{fontWeight:700,fontSize:11,color:"#8b7cb4",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Beshert Representative</div>
            <div style={{borderBottom:"1.5px solid #999",height:50,marginBottom:4}}/>
            <div style={{borderBottom:"1.5px solid #ccc",marginTop:12,marginBottom:4,height:28,display:"flex",alignItems:"flex-end"}}><span style={{fontSize:12,fontWeight:600}}>Carlito · Beshert Roofing Redevelopment Group</span></div>
            <div style={{borderBottom:"1.5px solid #ccc",marginTop:10,marginBottom:4,height:28}}/><div style={{fontSize:11,color:"#666"}}>Date</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{background:"#1a2744",color:"#fff",padding:"7px 20px",fontSize:10,textAlign:"center",letterSpacing:1.5,borderRadius:"0 0 6px 6px"}}>
        ISSUED BY BESHERT, A QUALIFIED 501(C)(3) NONPROFIT ORGANIZATION · www.thebeshertgroup.com
      </div>
    </div>
  );
}

function WorkAuthPreview({roofingLogo,churchLogo,client,job,contractNumber,docDate,preparedBy,totalPrice,paymentSplit,signature,signatureTimestamp,signatureIP,scopeItems}) {
  return (
    <div id="work-auth-area" style={{maxWidth:820,margin:"0 auto",fontFamily:"Georgia,serif",fontSize:13,color:"#1a1a2a",background:"#fff",position:"relative"}}>
      <Watermark churchLogo={churchLogo}/>
      <style>{`@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}#work-auth-area{max-width:100%;}}`}</style>
      {/* Header */}
      <div style={{background:"#1a2744",color:"#fff",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",borderRadius:"6px 6px 0 0"}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          {roofingLogo&&<img src={roofingLogo} alt="" style={{height:48,objectFit:"contain",background:"#fff",borderRadius:4,padding:3}}/>}
          <div>
            <div style={{fontWeight:700,fontSize:13,letterSpacing:1}}>BESHERT ROOFING REDEVELOPMENT GROUP</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.6)",letterSpacing:2}}>MAGNANIMOUS LIFE · 501(C)(3) · EST. 2005</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.55)",marginTop:2}}>📞 (216) 326-ROOF · beshert@thebeshertgroup.com</div>
          </div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:16,fontWeight:700,letterSpacing:2,color:"#C9A84C"}}>WORK AUTHORIZATION</div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.6)",marginTop:2}}>{docDate}</div>
          {contractNumber&&<div style={{marginTop:4,background:"rgba(255,255,255,0.15)",borderRadius:4,padding:"2px 8px",fontSize:10,fontFamily:"monospace",color:"#C9A84C"}}>{contractNumber}</div>}
        </div>
      </div>
      {/* Property + Job */}
      <div style={{background:"#ece9f4",padding:"14px 20px",borderBottom:"2px solid #8b7cb4"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
          <div>
            <div style={{fontWeight:700,fontSize:10,color:"#8b7cb4",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Property & Homeowner</div>
            <div style={{fontWeight:700}}>{client?.name||"—"}</div>
            <div style={{fontSize:12}}>{client?.address}</div>
            <div style={{fontSize:12}}>{client?.city}{client?.state?`, ${client.state}`:""}{client?.zip?` ${client.zip}`:""}</div>
            {client?.phone&&<div style={{fontSize:12}}>📞 {client.phone}</div>}
          </div>
          <div>
            <div style={{fontWeight:700,fontSize:10,color:"#8b7cb4",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Authorized Work</div>
            <div style={{fontWeight:700}}>{job?.label||"—"}</div>
            <div style={{fontSize:12,color:"#555",marginTop:4}}>{(scopeItems||[]).filter(s=>s.on).slice(0,3).map(s=>s.text).join(" · ")}{(scopeItems||[]).filter(s=>s.on).length>3?" · (+ more)":""}</div>
            <div style={{fontSize:12,fontWeight:700,color:"#1a2744",marginTop:6}}>Agreed Price: {new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(parseFloat(String(totalPrice||"0").replace(/[^0-9.]/g,""))||0)}</div>
          </div>
        </div>
      </div>
      {/* Authorization language */}
      <div style={{padding:"16px 20px",borderBottom:"1px solid #e2e8f0"}}>
        <div style={{borderLeft:"4px solid #8b7cb4",paddingLeft:12,color:"#1a2744",fontWeight:700,fontSize:13,letterSpacing:1,marginBottom:12}}>AUTHORIZATION</div>
        <div style={{fontSize:12.5,lineHeight:1.8,color:"#333"}}>
          I, <strong>{client?.name||"_______________________"}</strong>, authorize Beshert Roofing Redevelopment Group to begin the work described above at the property listed. By signing this document, I agree that:
        </div>
        <ul style={{fontSize:12,color:"#444",paddingLeft:20,marginTop:10,lineHeight:2}}>
          <li>Beshert and its crew have my permission to access the property and begin work on or around the agreed start date.</li>
          <li>Payment will be made per the schedule described in the referenced estimate ({contractNumber||"—"}).</li>
          <li>Any changes to the scope of work must be agreed in writing before additional work begins.</li>
          <li>This authorization is in addition to — and does not replace — the signed estimate.</li>
        </ul>
      </div>
      {/* Signature blocks */}
      <div style={{padding:"16px 20px",borderBottom:"2px solid #ece9f4"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:30}}>
          <div>
            <div style={{fontWeight:700,fontSize:11,color:"#8b7cb4",textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>Homeowner Authorization</div>
            {signature
              ?<img src={signature} alt="Signature" style={{height:50,maxWidth:"100%",objectFit:"contain",marginBottom:4,display:"block"}}/>
              :<div style={{borderBottom:"1.5px solid #999",height:50,marginBottom:4}}/>}
            <div style={{fontSize:11,color:"#666"}}>Signature</div>
            {signatureTimestamp&&<div style={{fontSize:9.5,color:"#888",marginTop:3,fontStyle:"italic"}}>✓ Signed: {signatureTimestamp}</div>}
            {signatureIP&&<div style={{fontSize:9,color:"#aaa"}}>IP: {signatureIP}</div>}
            <div style={{borderBottom:"1.5px solid #ccc",marginTop:14,marginBottom:4,height:28}}/><div style={{fontSize:11,color:"#666"}}>Print Name</div>
            <div style={{borderBottom:"1.5px solid #ccc",marginTop:10,marginBottom:4,height:28}}/><div style={{fontSize:11,color:"#666"}}>Date</div>
          </div>
          <div>
            <div style={{fontWeight:700,fontSize:11,color:"#8b7cb4",textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>Beshert Representative</div>
            <div style={{borderBottom:"1.5px solid #999",height:50,marginBottom:4}}/>
            <div style={{fontSize:11,color:"#666"}}>Signature</div>
            <div style={{borderBottom:"1.5px solid #ccc",marginTop:14,marginBottom:4,height:28,display:"flex",alignItems:"flex-end"}}><span style={{fontSize:12,color:"#333",fontWeight:600}}>{preparedBy||"Carlito"}</span></div>
            <div style={{fontSize:11,color:"#666"}}>Print Name</div>
            <div style={{borderBottom:"1.5px solid #ccc",marginTop:10,marginBottom:4,height:28}}/><div style={{fontSize:11,color:"#666"}}>Date</div>
          </div>
        </div>
      </div>
      {/* Footer */}
      <div style={{background:"#1a2744",color:"#fff",padding:"7px 20px",fontSize:10,textAlign:"center",letterSpacing:1.5,borderRadius:"0 0 6px 6px"}}>
        ISSUED BY BESHERT, A QUALIFIED 501(C)(3) NONPROFIT ORGANIZATION · www.thebeshertgroup.com
      </div>
    </div>
  );
}

function HelpTopic({topic, isLast}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{borderBottom:isLast?"none":"1px solid #ece9f4",marginBottom:isLast?0:4}}>
      <button onClick={()=>setOpen(p=>!p)} style={{width:"100%",background:"none",border:"none",padding:"12px 4px",display:"flex",alignItems:"center",gap:12,cursor:"pointer",textAlign:"left"}}>
        <span style={{fontSize:20,flexShrink:0}}>{topic.icon}</span>
        <span style={{fontWeight:700,fontSize:14,color:"#1a2744",flex:1,fontFamily:"Georgia,serif"}}>{topic.title}</span>
        <span style={{fontSize:16,color:"#888",flexShrink:0}}>{open?"▲":"▼"}</span>
      </button>
      {open && (
        <div style={{padding:"0 4px 14px 36px",fontSize:13,color:"#444",lineHeight:1.7,fontFamily:"Georgia,serif"}}
          dangerouslySetInnerHTML={{__html:topic.content.replace(/\n/g,"<br/>")}}/>
      )}
    </div>
  );
}

function BillingInvoicePreview({roofingLogo,preparedBy,pm,bInvNum,bInvDate,bInvDueDate,bInvClient,bInvLines,bInvTerms,bInvMethods,bInvStatus}) {
  const subtotal = bInvLines.reduce((sum,l)=>sum+(parseFloat(String(l.amt).replace(/[^0-9.]/g,""))||0),0);
  const fmtA = n => "$"+((parseFloat(String(n).replace(/[^0-9.]/g,""))||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}));
  return (
    <div id="print-area" style={{fontFamily:"Georgia,serif",maxWidth:780,margin:"0 auto",background:"#fff",position:"relative",fontSize:13,border:"1px solid #e2e8f0"}}>
      {bInvStatus==="Paid"&&(<div style={{position:"absolute",top:0,left:0,right:0,bottom:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none",zIndex:200,overflow:"hidden"}}><div style={{border:"7px solid rgba(21,156,89,0.65)",color:"rgba(21,156,89,0.65)",fontSize:80,fontWeight:900,transform:"rotate(-32deg)",letterSpacing:6,padding:"8px 18px",borderRadius:10,lineHeight:1}}>PAID</div></div>)}
      <div style={{textAlign:"center",padding:"24px 20px 16px",borderBottom:"3px solid #1a2744"}}>
        {roofingLogo&&<img src={roofingLogo} alt="Beshert" style={{height:80,objectFit:"contain",display:"block",margin:"0 auto 10px"}}/>}
        <div style={{fontWeight:700,fontSize:15,color:"#1a2744",letterSpacing:1}}>THE BESHERT GROUP</div>
        <div style={{fontSize:12,color:"#444",marginTop:2}}>DBA: MAGNANIMOUS LIFE, 501(C)3</div>
        <div style={{fontSize:11,color:"#666",marginTop:2}}>"A TRUSTED CHOICE SINCE 2005"</div>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",padding:"16px 24px",borderBottom:"1px solid #e2e8f0",gap:16}}>
        <div style={{flex:1,minWidth:200,fontSize:12,lineHeight:1.8,color:"#333"}}><div style={{fontWeight:700,fontSize:13}}>📞 (216) 326-ROOF</div><div>Mobile: 440-554-5332</div><div>Email: beshert@thebeshertgroup.com</div><div>Website: www.thebeshertgroup.com</div></div>
        <div style={{fontSize:12,lineHeight:1.8,color:"#333"}}><div><strong>Prepared by:</strong> {preparedBy}</div><div><strong>Project Manager:</strong> {pm}</div></div>
      </div>
      <div style={{padding:"16px 24px",borderBottom:"1px solid #e2e8f0"}}>
        <div style={{display:"grid",gridTemplateColumns:"160px 1fr",gap:4}}>
          <div style={{fontWeight:700,fontSize:13}}>Invoice For:</div>
          <div style={{fontSize:12,lineHeight:1.9}}><div><strong>Name:</strong> {bInvClient.name}</div><div><strong>Address:</strong> {bInvClient.address}</div><div><strong>City, State, ZIP:</strong> {bInvClient.city}</div></div>
        </div>
      </div>
      <div style={{padding:"16px 24px",borderBottom:"1px solid #e2e8f0"}}>
        <div style={{fontWeight:700,fontSize:12,marginBottom:8,textTransform:"uppercase",letterSpacing:1,color:"#1a2744"}}>Invoice Details</div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{background:"#1a2744"}}>{["Invoice Number","Invoice Date","Due Date"].map(h=><th key={h} style={{padding:"8px 12px",textAlign:"left",color:"rgba(255,255,255,0.8)",fontWeight:600}}>{h}</th>)}</tr></thead>
          <tbody><tr style={{background:"#f8f9fb"}}><td style={{padding:"9px 12px",fontWeight:700,color:"#1a2744",fontFamily:"monospace"}}>{bInvNum}</td><td style={{padding:"9px 12px"}}>{bInvDate}</td><td style={{padding:"9px 12px"}}>{bInvDueDate}</td></tr></tbody>
        </table>
      </div>
      <div style={{padding:"16px 24px",borderBottom:"1px solid #e2e8f0"}}>
        <div style={{fontWeight:700,fontSize:12,marginBottom:8,textTransform:"uppercase",letterSpacing:1,color:"#1a2744"}}>Description of Services</div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{background:"#1a2744"}}><th style={{padding:"8px 12px",textAlign:"left",color:"rgba(255,255,255,0.8)",fontWeight:600,width:"75%"}}>Description</th><th style={{padding:"8px 12px",textAlign:"right",color:"rgba(255,255,255,0.8)",fontWeight:600}}>Amount</th></tr></thead>
          <tbody>{bInvLines.filter(l=>l.desc||l.amt).map((l,i)=><tr key={l.id} style={{background:i%2===0?"#fff":"#f8f9fb",borderBottom:"1px solid #e2e8f0"}}><td style={{padding:"9px 12px"}}>{l.desc}</td><td style={{padding:"9px 12px",textAlign:"right",fontWeight:500}}>{l.amt?fmtA(l.amt):""}</td></tr>)}</tbody>
        </table>
      </div>
      <div style={{padding:"16px 24px",borderBottom:"1px solid #e2e8f0"}}>
        <div style={{fontWeight:700,fontSize:12,marginBottom:8,textTransform:"uppercase",letterSpacing:1,color:"#1a2744"}}>Total Due</div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{background:"#1a2744"}}>{["Subtotal","Total Due"].map(h=><th key={h} style={{padding:"8px 12px",textAlign:"right",color:"rgba(255,255,255,0.8)",fontWeight:600}}>{h}</th>)}</tr></thead>
          <tbody><tr style={{background:"#ece9f4"}}><td style={{padding:"10px 12px",textAlign:"right",fontWeight:700,fontSize:14}}>{fmtA(subtotal)}</td><td style={{padding:"10px 12px",textAlign:"right",fontWeight:700,fontSize:15,color:"#1a2744"}}>{fmtA(subtotal)}</td></tr></tbody>
        </table>
      </div>
      <div style={{padding:"14px 24px",borderBottom:"1px solid #e2e8f0",fontSize:12,lineHeight:1.8}}><div><strong>Payment Terms:</strong> {bInvTerms}</div><div><strong>Accepted Payment Methods:</strong> {bInvMethods}</div></div>
      <div style={{padding:"14px 24px",fontSize:12,color:"#444",lineHeight:1.7,borderBottom:"1px solid #e2e8f0"}}>Thank you for your business and prompt payment. Please include the invoice number with all payments for proper credit.</div>
      <div style={{textAlign:"center",padding:"16px 24px",borderTop:"3px solid #1a2744"}}><div style={{fontWeight:700,fontSize:14,color:"#1a2744"}}>The Beshert Group</div><div style={{fontSize:12,color:"#888",marginTop:3,letterSpacing:1}}>Excellence. Integrity. Commitment.</div></div>
    </div>
  );
}

function BeshertBuilder() {
  // ── Mode & Step ──
  const [mode,         setMode]        = useState("proposal");
  const [step,         setStep]        = useState(1);
  const [showPreview,  setShowPreview] = useState(false);
  const [docType,      setDocType]     = useState("estimate");

  // ── Proposal State ──
  const [jobType,      setJobType]     = useState("tearoff");
  const [paymentSplit, setSplit]       = useState("33/33/34");
  const [client,       setClient]      = useState({name:"",title:"",company:"",address:"",city:"Cleveland",state:"OH",zip:"",phone:"",email:""});
  const [lastName,     setLastName]    = useState("");
  const [houseNum,     setHouseNum]    = useState("");
  const [camLink,      setCamLink]     = useState("");
  const [preparedBy,   setPreparedBy]  = useState(DEFAULT_PREPARED_BY);
  const [pm,           setPm]          = useState(DEFAULT_PM);
  const [docDate,      setDocDate]     = useState(today());
  const [scopeItems,   setScopeItems]  = useState(JOBS.tearoff.scope.map((t,i)=>({id:i,text:t,on:true})));
  const [newScope,     setNewScope]    = useState("");
  const [finalPages,   setFinalPages]  = useState([
    ...STANDARD_PROVISIONS.map(sp=>({id:sp.id,label:sp.title,on:true})),
    {id:"br1",label:"Buyer's Right to Cancel (Ohio Law)",on:true}
  ]);
  const [totalPrice,   setTotalPrice]  = useState("");
  const [priceDesc,    setPriceDesc]   = useState("");
  const [optItems,     setOptItems]    = useState([]);
  const [newOptText,   setNewOptText]  = useState("");
  const [newOptPrice,  setNewOptPrice] = useState("");

  // ── NEW: Additional Jobs ──
  const [additionalJobs,    setAdditionalJobs]    = useState([]);
  const [newJobType,        setNewJobType]        = useState("repair");
  const [newJobDesc,        setNewJobDesc]        = useState("");
  const [newJobPrice,       setNewJobPrice]       = useState("");
  const [expandedJobScopes, setExpandedJobScopes] = useState({});
  const [newJobScopeTexts,  setNewJobScopeTexts]  = useState({});

  // ── NEW: Payment Structure ──
  const [paymentStructure, setPaymentStructure] = useState("split");
  const [customPayments,   setCustomPayments]   = useState([
    {id:1,label:"Due Now",amount:""},
    {id:2,label:"Balance Due Upon Completion",amount:""}
  ]);

  // ── NEW: Add-On Library ──
  const [addonLibrary, setAddonLibrary] = useState([]);

  // ── Mobile detection ──
  const [windowWidth, setWindowWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  useEffect(()=>{
    const h = ()=>setWindowWidth(window.innerWidth);
    window.addEventListener("resize",h);
    return ()=>window.removeEventListener("resize",h);
  },[]);
  const isMobile = windowWidth < 700;
  const isTablet = windowWidth < 960;

  // ── Phone format helper ──
  const formatPhone = (val) => {
    const d = val.replace(/\D/g,"").slice(0,10);
    if(d.length<=3) return d;
    if(d.length<=6) return `(${d.slice(0,3)}) ${d.slice(3)}`;
    return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
  };

  // ── V14 Quick Estimate mode ──
  const [proposalMode, setProposalMode] = useState("quick"); // "quick" | "full"

  // ── V14 Notes, Toasts, Sync ──
  const [notes,        setNotes]       = useState("");
  const [toasts,       setToasts]      = useState([]);
  const [unsyncedIds,  setUnsyncedIds] = useState(()=>{try{return JSON.parse(localStorage.getItem("brrg_unsynced")||"[]");}catch(e){return[];}});
  const [isSyncing,    setIsSyncing]   = useState(false);
  const [showAnalytics,setShowAnalytics]=useState(false);
  const [showHelp,     setShowHelp]     =useState(false);

  const addToast = (msg, type="info") => {
    const id = Date.now()+Math.random();
    setToasts(p=>[...p,{id,msg,type}]);
    setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),4500);
  };
  const markUnsynced = (cnum) => { setUnsyncedIds(p=>{ const u=[...new Set([...p,cnum])]; localStorage.setItem("brrg_unsynced",JSON.stringify(u)); return u; }); };
  const markSynced   = (cnum) => { setUnsyncedIds(p=>{ const u=p.filter(id=>id!==cnum); localStorage.setItem("brrg_unsynced",JSON.stringify(u)); return u; }); };

  // ── V13 Insurance + Email FROM ──
  const [isInsuranceJob, setIsInsuranceJob] = useState(false);
  const [insFields, setInsFields] = useState({insurer:"",claimNum:"",policyNum:"",adjuster:"",dateOfLoss:"",deductible:"",acv:"",rcv:"",depreciation:"",supplementNum:""});
  const [sendFromEmail, setSendFromEmail] = useState("beshert@thebeshertgroup.com");
  const [dashboardSearch, setDashboardSearch] = useState("");

  // ── V12 Billing Invoice State ──
  const [bInvNum,    setBInvNum]    = useState("");
  const [bInvDate,   setBInvDate]   = useState(today());
  const [bInvDueDate,setBInvDueDate]= useState("Due upon receipt");
  const [bInvClient, setBInvClient] = useState({name:"",address:"",city:""});
  const [bInvLines,  setBInvLines]  = useState([{id:1,desc:"",amt:""}]);
  const [bInvTerms,  setBInvTerms]  = useState("Due upon receipt.");
  const [bInvMethods,setBInvMethods]= useState("Check, ACH, or other approved method.");
  const [bInvContract,setBInvContract]=useState("");
  const [bInvPreview,setBInvPreview]= useState(false);
  const [bInvSaved,  setBInvSaved]  = useState(false);
  const [bInvSaving, setBInvSaving] = useState(false);
  const [bInvStatus, setBInvStatus] = useState("Invoiced");
  const [updatingStatusId,setUpdatingStatusId]=useState(null);

  // ── V11 New State ──
  const [status,setStatus]=useState("Pending");
  const [measurements,setMeasurements]=useState({squares:"",pitch:"4/12",layers:"1",decking:"Good"});
  const [materials,setMaterials]=useState([]);
  const [materialLibrary,setMaterialLibrary]=useState([]);
  const [newMaterialText,setNewMaterialText]=useState("");
  const [signature,setSignature]=useState(null);
  const [showSigPad,       setShowSigPad]       =useState(false);
  const [signatureTimestamp,setSignatureTimestamp]=useState(null);
  const [signatureIP,       setSignatureIP]       =useState(null);
  const [showWorkAuth,      setShowWorkAuth]      =useState(false);
  const [showLOA,           setShowLOA]           =useState(false);
  const [isListening,       setIsListening]       =useState(false);
  const [workAuthGenerated, setWorkAuthGenerated] =useState(false);
  const [loaGenerated,      setLoaGenerated]      =useState(false);
  const sigCanvasRef=useRef(null);
  const sigDrawing=useRef(false);
  const [clientEmail,setClientEmail]=useState("");
  const [showEmailModal,setShowEmailModal]=useState(false);
  const [emailStatus,setEmailStatus]=useState("idle");
  const [appMode,setAppMode]=useState("form");
  const [dashboardData,setDashboardData]=useState([]);
  const [dashboardLoading,setDashboardLoading]=useState(false);
  const [dashboardFilter,setDashboardFilter]=useState("All");
  const [hasDraft,setHasDraft]=useState(false);
  const [validationErrors,setValidationErrors]=useState([]);
  // ── Contract State ──
  const [contractNumber, setContractNumber] = useState("");
  const [contractLink,   setContractLink]   = useState("");
  const [isSaved,        setIsSaved]        = useState(false);
  const [saveStatus,     setSaveStatus]     = useState("");
  const [isPdfLoading,   setIsPdfLoading]   = useState(false);

  // ── Load & Edit State ──
  const [showLoadPanel,  setShowLoadPanel]  = useState(false);
  const [loadEditInput,  setLoadEditInput]  = useState("");
  const [loadEditError,  setLoadEditError]  = useState("");
  const [isEditing,      setIsEditing]      = useState(false);

  // ── Invoice State ──
  const [invNum,         setInvNum]         = useState("");
  const [invDue,         setInvDue]         = useState("");
  const [invPaid,        setInvPaid]        = useState("");
  const [invStarted,     setInvStarted]     = useState(false);
  const [linkedContract, setLinkedContract] = useState("");
  const [loadInput,      setLoadInput]      = useState("");
  const [recentEsts,     setRecentEsts]     = useState([]);
  const [loadError,      setLoadError]      = useState("");

  // ── Mount: load recent estimates, addon library, and URL param ──
  useEffect(()=>{
    storage.list().then(list => setRecentEsts(Array.isArray(list)?list:[]));
    setAddonLibrary(loadAddonLib());
    setMaterialLibrary(loadMaterialLib());
    const draftStr=localStorage.getItem(DRAFT_KEY);
    const urlp=new URLSearchParams(window.location.search);
    if(draftStr&&!urlp.get("contract")){try{const d=JSON.parse(draftStr);if(d.client?.name||d.totalPrice)setHasDraft(true);}catch(e){}}
    // Auto-load from URL ?contract= param
    const params = new URLSearchParams(window.location.search);
    const contractParam = params.get("contract");
    if(contractParam) {
      storage.get(contractParam).then(est=>{
        if(!est) return;
        const jt = est.jobType||"tearoff";
        setClient(est.client||{name:"",title:"",company:"",address:"",city:"Cleveland",state:"OH",zip:"",phone:"",email:""});
        setLastName(est.lastName||"");
        setHouseNum(est.houseNum||"");
        setCamLink(est.camLink||"");
        setJobType(jt);
        setSplit(est.paymentSplit||"33/33/34");
        setPreparedBy(est.preparedBy||DEFAULT_PREPARED_BY);
        setPm(est.pm||DEFAULT_PM);
        setDocDate(est.docDate||today());
        setTotalPrice(String(est.totalPrice||""));
        setPriceDesc(est.priceDesc||"");
        setOptItems(est.optItems||[]);
        setAdditionalJobs(est.additionalJobs||[]);
        setPaymentStructure(est.paymentStructure||"split");
        setCustomPayments(est.customPayments||[{id:1,label:"Due Now",amount:""},{id:2,label:"Balance Due Upon Completion",amount:""}]);
        setContractNumber(est.contractNumber);
        setContractLink(`https://beshertroofing.netlify.app/?contract=${est.contractNumber}`);
        setStatus(est.status||"Pending");
        setMeasurements(est.measurements||{squares:"",pitch:"4/12",layers:"1",decking:"Good"});
        setClientEmail(est.clientEmail||"");
        setMaterials(est.materials?.map((t,i)=>({id:i,text:t,on:true}))||[]);
        setSignature(est.signature||null);
        setNotes(est.notes||"");
        setIsInsuranceJob(est.isInsuranceJob||false);
        setInsFields(est.insFields||{insurer:"",claimNum:"",policyNum:"",adjuster:"",dateOfLoss:"",deductible:"",acv:"",rcv:"",depreciation:"",supplementNum:""});
        setIsEditing(true);
        if(est.scopeItems&&Array.isArray(est.scopeItems)&&est.scopeItems.length>0){
          setScopeItems(est.scopeItems.map((text,i)=>({id:i,text,on:true})));
        } else {
          setScopeItems(JOBS[jt].scope.map((text,i)=>({id:i,text,on:true})));
        }
        const savedIds=est.finalPageIds||[];
        setFinalPages([
          ...STANDARD_PROVISIONS.map(sp=>({id:sp.id,label:sp.title,on:savedIds.length===0?true:savedIds.includes(sp.id)})),
          {id:"br1",label:"Buyer's Right to Cancel (Ohio Law)",on:savedIds.length===0?true:savedIds.includes("br1")}
        ]);
      });
    }
  },[]);

  // ── Computed Values ──
  const job             = JOBS[jobType];
  const baseParsedTotal = parseFloat(String(totalPrice).replace(/[^0-9.]/g,""))||0;

  // ── Talk to text ──
  const startListening = (onResult) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SR){ addToast("Voice input not supported in this browser","error"); return; }
    if(isListening) return;
    const rec = new SR();
    rec.continuous = false; rec.interimResults = false; rec.lang = "en-US";
    rec.onresult = (e) => { onResult(e.results[0][0].transcript); setIsListening(false); };
    rec.onerror  = ()  => { addToast("Voice input failed — try again","warning"); setIsListening(false); };
    rec.onend    = ()  => setIsListening(false);
    rec.start(); setIsListening(true);
  };

  // ── Save reminder (must be after isSaved + baseParsedTotal) ──
  const hasUnsavedData = !isSaved && (client.name.trim().length>0 || client.address.trim().length>0 || baseParsedTotal>0);
  useEffect(()=>{
    const handler=(e)=>{if(hasUnsavedData){e.preventDefault();e.returnValue="";}};
    window.addEventListener("beforeunload",handler);
    return()=>window.removeEventListener("beforeunload",handler);
  },[hasUnsavedData]);
  const addJobsTotal    = additionalJobs.reduce((s,j)=>s+(parseFloat(String(j.price||"0").replace(/[^0-9.]/g,""))||0),0);
  const parsedTotal     = baseParsedTotal + addJobsTotal;
  const addonTotal      = optItems.filter(o=>o.includeInTotal&&parseFloat(o.price)>0).reduce((s,o)=>s+parseFloat(o.price),0);
  const withTotal       = parsedTotal + addonTotal;
  const hasAddons       = addonTotal > 0;

  // ── Handlers ──
  const switchJob    = t  => {setJobType(t);setScopeItems(JOBS[t].scope.map((text,i)=>({id:i,text,on:true})));setSplit(JOBS[t].defaultSplit);};
  const toggleScope  = id => setScopeItems(p=>p.map(s=>s.id===id?{...s,on:!s.on}:s));
  const editScope    = (id,v) => setScopeItems(p=>p.map(s=>s.id===id?{...s,text:v}:s));
  const removeScope  = id => setScopeItems(p=>p.filter(s=>s.id!==id));
  const addScope     = () => {if(!newScope.trim()) return; setScopeItems(p=>[...p,{id:Date.now(),text:newScope,on:true}]); setNewScope("");};
  const toggleFP     = id => setFinalPages(p=>p.map(fp=>fp.id===id?{...fp,on:!fp.on}:fp));

  const addOptItem    = () => {
    if(!newOptText.trim()) return;
    saveToAddonLib(newOptText);
    setAddonLibrary(loadAddonLib());
    setOptItems(p=>[...p,{id:Date.now(),text:newOptText,price:newOptPrice,includeInTotal:!!newOptPrice}]);
    setNewOptText(""); setNewOptPrice("");
  };
  const removeOptItem = id => setOptItems(p=>p.filter(o=>o.id!==id));
  const updateOpt     = (id,f,v) => setOptItems(p=>p.map(o=>o.id===id?{...o,[f]:v}:o));

  const addAdditionalJob = () => {
    if(!newJobPrice||!parseFloat(String(newJobPrice).replace(/[^0-9.]/g,""))) return;
    const jid = Date.now();
    setAdditionalJobs(p=>[...p,{
      id:jid,
      type:newJobType,
      desc:newJobDesc||JOBS[newJobType]?.label||newJobType,
      price:newJobPrice,
      scopeItems:JOBS[newJobType].scope.map((text,i)=>({id:jid+i+1,text,on:true}))
    }]);
    setNewJobDesc(""); setNewJobPrice("");
  };
  const removeAdditionalJob = id => {
    setAdditionalJobs(p=>p.filter(j=>j.id!==id));
    setExpandedJobScopes(p=>{const n={...p}; delete n[id]; return n;});
  };
  const toggleAdditionalJobScope = (jobId, scopeId) =>
    setAdditionalJobs(p=>p.map(j=>j.id!==jobId?j:{...j,scopeItems:j.scopeItems.map(s=>s.id===scopeId?{...s,on:!s.on}:s)}));
  const editAdditionalJobScopeText = (jobId, scopeId, val) =>
    setAdditionalJobs(p=>p.map(j=>j.id!==jobId?j:{...j,scopeItems:j.scopeItems.map(s=>s.id===scopeId?{...s,text:val}:s)}));
  const removeAdditionalJobScopeItem = (jobId, scopeId) =>
    setAdditionalJobs(p=>p.map(j=>j.id!==jobId?j:{...j,scopeItems:j.scopeItems.filter(s=>s.id!==scopeId)}));
  const addAdditionalJobScopeItem = (jobId) => {
    const text = (newJobScopeTexts[jobId]||"").trim();
    if(!text) return;
    setAdditionalJobs(p=>p.map(j=>j.id!==jobId?j:{...j,scopeItems:[...(j.scopeItems||[]),{id:Date.now(),text,on:true}]}));
    setNewJobScopeTexts(p=>({...p,[jobId]:""}));
  };

  const updateCustomPayment = (id,f,v) => setCustomPayments(p=>p.map(cp=>cp.id===id?{...cp,[f]:v}:cp));
  const addCustomPayment    = () => setCustomPayments(p=>[...p,{id:Date.now(),label:"",amount:""}]);
  const removeCustomPayment = id => setCustomPayments(p=>p.filter(cp=>cp.id!==id));

  const handleSaveEstimate = async () => {
    setSaveStatus("saving");
    let cnum = contractNumber;
    if(!cnum) {
      const base = await storage.nextEstNum();
      const ln = lastName.trim().toUpperCase().replace(/[^A-Z0-9]/g,"");
      const hn = houseNum.trim().replace(/[^A-Z0-9]/gi,"");
      const suffix = [ln,hn].filter(Boolean).join("-");
      cnum = suffix ? `${base}-${suffix}` : base;
      setContractNumber(cnum);
    }
    const link = `https://beshertroofing.netlify.app/?contract=${cnum}`;
    setContractLink(link);
    const est = {
      contractNumber:cnum,dateCreated:today(),docDate,client,lastName,houseNum,camLink,
      jobType,paymentSplit,paymentStructure,customPayments,
      preparedBy,pm,totalPrice:baseParsedTotal,priceDesc,optItems,
      additionalJobs,contractLink:link,
      scopeItems:scopeItems.filter(s=>s.on).map(s=>s.text),
      finalPageIds:finalPages.filter(fp=>fp.on).map(fp=>fp.id),
      status,measurements,clientEmail,isInsuranceJob,insFields,
      materials:materials.map(m=>m.text),
      signature:signature||null, signatureTimestamp:signatureTimestamp||null, signatureIP:signatureIP||null,
      notes, workAuthGenerated, loaGenerated, cloudSynced:false
    };
    const res = await storage.save(est);
    setIsSaved(true);
    if(res.local) {
      setSaveStatus("saved-local");
      markUnsynced(cnum);
      addToast("⚠ Saved to this device only — Google Sheets unreachable","warning");
    } else {
      setSaveStatus("saved");
      markSynced(cnum);
      addToast("✓ Estimate saved and synced","success");
    }
    const newList = await storage.list();
    setRecentEsts(Array.isArray(newList)?newList:[]);
  };

  const handleLoadForEdit = async (cnum) => {
    setLoadEditError("");
    const est = await storage.get(cnum||loadEditInput.trim());
    if(!est){setLoadEditError("Contract not found. Check the number and try again."); return;}
    const jt = est.jobType||"tearoff";
    setClient(est.client||{name:"",title:"",company:"",address:"",city:"Cleveland",state:"OH",zip:"",phone:"",email:""});
    setLastName(est.lastName||"");
    setHouseNum(est.houseNum||"");
    setCamLink(est.camLink||"");
    setJobType(jt);
    setSplit(est.paymentSplit||"33/33/34");
    setPaymentStructure(est.paymentStructure||"split");
    setCustomPayments(est.customPayments||[{id:1,label:"Due Now",amount:""},{id:2,label:"Balance Due Upon Completion",amount:""}]);
    setPreparedBy(est.preparedBy||DEFAULT_PREPARED_BY);
    setPm(est.pm||DEFAULT_PM);
    setDocDate(est.docDate||today());
    setTotalPrice(String(est.totalPrice||""));
    setPriceDesc(est.priceDesc||"");
    setOptItems(est.optItems||[]);
    setAdditionalJobs(est.additionalJobs||[]);
    setContractNumber(est.contractNumber);
    setContractLink(est.contractLink||"");
    setStatus(est.status||"Pending");
    setMeasurements(est.measurements||{squares:"",pitch:"4/12",layers:"1",decking:"Good"});
    setClientEmail(est.clientEmail||"");
    setMaterials(est.materials?.map((t,i)=>({id:i,text:t,on:true}))||[]);
    setSignature(est.signature||null);
    setSignatureTimestamp(est.signatureTimestamp||null);
    setSignatureIP(est.signatureIP||null);
    setNotes(est.notes||"");
    setWorkAuthGenerated(est.workAuthGenerated||false);
    setLoaGenerated(est.loaGenerated||false);
    setIsInsuranceJob(est.isInsuranceJob||false);
    setInsFields(est.insFields||{insurer:"",claimNum:"",policyNum:"",adjuster:"",dateOfLoss:"",deductible:"",acv:"",rcv:"",depreciation:"",supplementNum:""});
    setIsEditing(true);
    setIsSaved(false);
    setSaveStatus("");
    if(est.scopeItems&&Array.isArray(est.scopeItems)&&est.scopeItems.length>0){
      setScopeItems(est.scopeItems.map((text,i)=>({id:i,text,on:true})));
    } else {
      setScopeItems(JOBS[jt].scope.map((text,i)=>({id:i,text,on:true})));
    }
    const savedIds=est.finalPageIds||[];
    setFinalPages([
      ...STANDARD_PROVISIONS.map(sp=>({id:sp.id,label:sp.title,on:savedIds.length===0?true:savedIds.includes(sp.id)})),
      {id:"br1",label:"Buyer's Right to Cancel (Ohio Law)",on:savedIds.length===0?true:savedIds.includes("br1")}
    ]);
    setShowLoadPanel(false);
    setLoadEditInput("");
  };

  const handleLoadEstimate = async (cnum) => {
    setLoadError("");
    const est = await storage.get(cnum||loadInput.trim());
    if(!est){setLoadError("Contract not found. Check the number and try again."); return;}
    setClient(est.client||{name:"",title:"",company:"",address:"",city:"Cleveland",state:"OH",zip:"",phone:"",email:""});
    setJobType(est.jobType||"tearoff");
    setSplit(est.paymentSplit||"33/33/34");
    setPaymentStructure(est.paymentStructure||"split");
    setCustomPayments(est.customPayments||[{id:1,label:"Due Now",amount:""},{id:2,label:"Balance Due Upon Completion",amount:""}]);
    setPreparedBy(est.preparedBy||DEFAULT_PREPARED_BY);
    setPm(est.pm||DEFAULT_PM);
    setTotalPrice(String(est.totalPrice||""));
    setPriceDesc(est.priceDesc||"");
    setOptItems(est.optItems||[]);
    setAdditionalJobs(est.additionalJobs||[]);
    setLinkedContract(est.contractNumber);
    const newInvNum = await storage.nextInvNum();
    setInvNum(newInvNum);
    setInvStarted(true);
  };

  const resetProposal = () => {
    setStep(1); setShowPreview(false); setDocType("estimate");
    setJobType("tearoff"); setSplit("33/33/34");
    setPaymentStructure("split");
    setCustomPayments([{id:1,label:"Due Now",amount:""},{id:2,label:"Balance Due Upon Completion",amount:""}]);
    setClient({name:"",title:"",company:"",address:"",city:"Cleveland",state:"OH",zip:"",phone:"",email:""});
    setLastName(""); setHouseNum(""); setCamLink("");
    setPreparedBy(DEFAULT_PREPARED_BY); setPm(DEFAULT_PM); setDocDate(today());
    setScopeItems(JOBS.tearoff.scope.map((t,i)=>({id:i,text:t,on:true})));
    setFinalPages([...STANDARD_PROVISIONS.map(sp=>({id:sp.id,label:sp.title,on:true})),{id:"br1",label:"Buyer's Right to Cancel (Ohio Law)",on:true}]);
    setTotalPrice(""); setPriceDesc(""); setOptItems([]);
    setAdditionalJobs([]); setNewJobDesc(""); setNewJobPrice("");
    setContractNumber(""); setContractLink(""); setIsSaved(false); setSaveStatus("");
    setIsEditing(false); setShowLoadPanel(false); setLoadEditInput(""); setLoadEditError("");
    setStatus("Pending"); setMeasurements({squares:"",pitch:"4/12",layers:"1",decking:"Good"});
    setMaterials([]); setNewMaterialText(""); setSignature(null); setSignatureTimestamp(null); setSignatureIP(null); setClientEmail("");
    setValidationErrors([]);
    setNotes(""); setWorkAuthGenerated(false); setLoaGenerated(false); setProposalMode("quick"); setIsInsuranceJob(false); setInsFields({insurer:"",claimNum:"",policyNum:"",adjuster:"",dateOfLoss:"",deductible:"",acv:"",rcv:"",depreciation:"",supplementNum:""});
    localStorage.removeItem(DRAFT_KEY);
  };

  // ── Download PDF (NEW) ──
  const handleDownloadPDF = async () => {
    setIsPdfLoading(true);
    try {
      if(!window.html2pdf) {
        await new Promise((resolve,reject)=>{
          const s=document.createElement('script');
          s.src='https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
          s.onload=resolve; s.onerror=reject;
          document.head.appendChild(s);
        });
      }
      const el = document.getElementById('print-area');
      const filename = contractNumber ? `${contractNumber}.pdf` : 'beshert-estimate.pdf';
      await html2pdf().set({
        margin:[0.4,0.4,0.4,0.4],
        filename,
        image:{type:'jpeg',quality:0.98},
        html2canvas:{scale:2,useCORS:true,logging:false},
        jsPDF:{unit:'in',format:'letter',orientation:'portrait'}
      }).from(el).save();
    } catch(e) { alert("PDF generation failed. Use Print/PDF instead."); }
    setIsPdfLoading(false);
  };

  // Inject print CSS once
  useEffect(()=>{
    if(!document.getElementById("brrg-print-css")){
      const s=document.createElement("style");
      s.id="brrg-print-css";
      s.textContent=printCSS;
      document.head.appendChild(s);
      const m=document.createElement("style");m.id="mobile-css";if(!document.getElementById("mobile-css")){m.textContent=mobileCSS;document.head.appendChild(m);}
    }
  },[]);

  useEffect(()=>{
    if(!client.name&&!totalPrice)return;
    try{const draft={client,lastName,houseNum,camLink,jobType,paymentSplit,paymentStructure,customPayments,preparedBy,pm,docDate,totalPrice,priceDesc,optItems,additionalJobs,contractNumber,status,measurements,materials,clientEmail,scopeItems:scopeItems.map(s=>s.text),isInsuranceJob,insFields,notes};localStorage.setItem(DRAFT_KEY,JSON.stringify(draft));}catch(e){}
  },[client,lastName,houseNum,jobType,totalPrice,scopeItems,status,measurements,materials,clientEmail,isInsuranceJob,insFields,notes]);
  const restoreDraft=()=>{try{const d=JSON.parse(localStorage.getItem(DRAFT_KEY)||"{}");if(d.client)setClient(d.client);if(d.lastName)setLastName(d.lastName);if(d.houseNum)setHouseNum(d.houseNum);if(d.camLink)setCamLink(d.camLink);if(d.jobType){setJobType(d.jobType);setScopeItems(d.scopeItems?.length>0?d.scopeItems.map((t,i)=>({id:i,text:t,on:true})):JOBS[d.jobType].scope.map((t,i)=>({id:i,text:t,on:true})));}if(d.paymentSplit)setSplit(d.paymentSplit);if(d.paymentStructure)setPaymentStructure(d.paymentStructure);if(d.customPayments)setCustomPayments(d.customPayments);if(d.preparedBy)setPreparedBy(d.preparedBy);if(d.pm)setPm(d.pm);if(d.docDate)setDocDate(d.docDate);if(d.totalPrice)setTotalPrice(String(d.totalPrice));if(d.priceDesc)setPriceDesc(d.priceDesc);if(d.optItems)setOptItems(d.optItems);if(d.additionalJobs)setAdditionalJobs(d.additionalJobs);if(d.contractNumber)setContractNumber(d.contractNumber);if(d.status)setStatus(d.status);if(d.measurements)setMeasurements(d.measurements);if(d.materials)setMaterials(d.materials);if(d.clientEmail)setClientEmail(d.clientEmail);if(d.isInsuranceJob!==undefined)setIsInsuranceJob(d.isInsuranceJob);if(d.insFields)setInsFields(d.insFields);if(d.notes)setNotes(d.notes);}catch(e){}setHasDraft(false);localStorage.removeItem(DRAFT_KEY);};
  const addMaterial=()=>{if(!newMaterialText.trim())return;saveMaterialLib(newMaterialText);setMaterialLibrary(loadMaterialLib());setMaterials(p=>[...p,{id:Date.now(),text:newMaterialText,on:true}]);setNewMaterialText("");};
  const toggleMaterial=id=>setMaterials(p=>p.map(m=>m.id===id?{...m,on:!m.on}:m));
  const editMaterial=(id,v)=>setMaterials(p=>p.map(m=>m.id===id?{...m,text:v}:m));
  const removeMaterial=id=>setMaterials(p=>p.filter(m=>m.id!==id));
  const sigGetPos=(e,cv)=>{const r=cv.getBoundingClientRect(),s=e.touches?e.touches[0]:e;return{x:(s.clientX-r.left)*(cv.width/r.width),y:(s.clientY-r.top)*(cv.height/r.height)};};
  const sigStart=(e)=>{e.preventDefault();const cv=sigCanvasRef.current;if(!cv)return;sigDrawing.current=true;const p=sigGetPos(e,cv);const ctx=cv.getContext("2d");ctx.beginPath();ctx.moveTo(p.x,p.y);};
  const sigMove=(e)=>{e.preventDefault();if(!sigDrawing.current)return;const cv=sigCanvasRef.current;if(!cv)return;const p=sigGetPos(e,cv);const ctx=cv.getContext("2d");ctx.lineWidth=2.5;ctx.lineCap="round";ctx.lineJoin="round";ctx.strokeStyle="#1a2744";ctx.lineTo(p.x,p.y);ctx.stroke();};
  const sigEnd=()=>{sigDrawing.current=false;};
  const sigClear=()=>{const cv=sigCanvasRef.current;if(!cv)return;cv.getContext("2d").clearRect(0,0,cv.width,cv.height);};
  const sigCapture=async()=>{
    const cv=sigCanvasRef.current; if(!cv)return;
    setSignature(cv.toDataURL("image/png"));
    const ts=new Date().toLocaleString("en-US",{weekday:"short",year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit",timeZoneName:"short"});
    setSignatureTimestamp(ts);
    try{const r=await fetch("https://api.ipify.org?format=json");const d=await r.json();setSignatureIP(d.ip);}
    catch(e){setSignatureIP("IP unavailable");}
    setShowSigPad(false);
  };
  const validate=()=>{const e=[];if(!client.name.trim())e.push("Client name is required");if(!client.address.trim())e.push("Property address is required");if(baseParsedTotal<=0)e.push("Total price must be greater than $0");setValidationErrors(e);return e.length===0;};
  const loadDashboard=async()=>{setDashboardLoading(true);const list=await storage.list();setDashboardData(Array.isArray(list)?list:[]);setDashboardLoading(false);};
  const handleMailto=()=>{
    if(!clientEmail.trim()){alert("Please enter a valid email address.");return;}
    const typeLabel=docType==="invoice"?"Invoice":"Estimate";
    const total=fmtAmt(hasAddons?withTotal:parsedTotal);
    const pLines=getPaymentLines(hasAddons?withTotal:parsedTotal,paymentStructure,paymentSplit,customPayments);
    const payText=pLines.length>0?'\n\nPayment Schedule:\n'+pLines.map(p=>`  ${p.label}: ${fmtAmt(p.amt)}`).join('\n'):'';
    const subject=encodeURIComponent(`Your ${typeLabel} from Beshert Roofing — ${contractNumber}`);
    const body=encodeURIComponent(
`Dear ${client.name||'Valued Client'},

Thank you for choosing Beshert Roofing Redevelopment Group. Please find your ${typeLabel.toLowerCase()} details below.

${typeLabel} Number: ${contractNumber}
Date: ${docDate}
Service: ${job.label}
Total: ${total}${payText}

If you have any questions, please contact us at any time.

Sincerely,
Carlito
Beshert Roofing Redevelopment Group
(216) 326-ROOF  |  Mobile: 440-554-5332
beshert@thebeshertgroup.com  |  www.thebeshertgroup.com`);
    window.open(`mailto:${clientEmail}?subject=${subject}&body=${body}`);
    setShowEmailModal(false);
  };
  const FROM_EMAILS = ["beshert@thebeshertgroup.com","cbrown7745@gmail.com"];
  const handleSaveBillingInvoice = async () => {
    if(!bInvNum){ alert("Please generate an invoice number first."); return; }
    setBInvSaving(true);
    const subtotal = bInvLines.reduce((sum,l)=>sum+(parseFloat(String(l.amt).replace(/[^0-9.]/g,""))||0),0);
    const inv = {
      contractNumber: bInvNum,
      docType: "billing_invoice",
      client: {name:bInvClient.name, address:bInvClient.address, city:bInvClient.city},
      bInvDate, bInvDueDate, bInvClient, bInvLines, bInvTerms, bInvMethods,
      bInvContract, status:bInvStatus, preparedBy, pm,
      totalPrice: subtotal,
      dateCreated: today()
    };
    await storage.save(inv);
    setBInvSaved(true);
    setBInvSaving(false);
    setDashboardData(prev=>{
      const idx=prev.findIndex(e=>e.contractNumber===bInvNum);
      if(idx>=0){const updated=[...prev];updated[idx]=inv;return updated;}
      return [...prev,inv];
    });
    setTimeout(()=>setBInvSaved(false),3000);
  };

  const handleLoadAndPreview = async (cnum) => {
    await handleLoadForEdit(cnum);
    setShowPreview(true);
    setStep(5);
    setMode("proposal");
    setAppMode("form");
  };

  const handleLoadBillingInvoice = (inv) => {
    setBInvNum(inv.contractNumber||"");
    setBInvDate(inv.bInvDate||today());
    setBInvDueDate(inv.bInvDueDate||"Due upon receipt");
    setBInvClient(inv.bInvClient||{name:"",address:"",city:""});
    setBInvLines(inv.bInvLines||[{id:1,desc:"",amt:""}]);
    setBInvTerms(inv.bInvTerms||"Due upon receipt.");
    setBInvMethods(inv.bInvMethods||"Check, ACH, or other approved method.");
    setBInvContract(inv.bInvContract||"");
    setBInvStatus(inv.status||"Invoiced");
    setBInvPreview(false);
    setBInvSaved(false);
    setMode("invoice");
    setAppMode("form");
  };

  const handleSyncUnsynced = async () => {
    if(unsyncedIds.length===0){addToast("All estimates are synced ☁","success");return;}
    setIsSyncing(true);
    let synced=0, failed=0;
    for(const cnum of [...unsyncedIds]) {
      const est = await storage.get(cnum);
      if(!est) { markSynced(cnum); continue; }
      try {
        const r = await fetch("/.netlify/functions/estimates",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...est,cloudSynced:true}),signal:AbortSignal.timeout(15000)});
        if(r.ok) { markSynced(cnum); synced++; } else { failed++; }
      } catch(e) { failed++; }
    }
    setIsSyncing(false);
    if(synced>0&&failed===0) addToast(`✓ ${synced} estimate${synced>1?"s":""} synced to cloud`,"success");
    else if(failed>0) addToast(`⚠ ${synced} synced, ${failed} failed — check connection`,"warning");
  };

  const handleDuplicateEstimate = async (contractNum) => {
    const est = await storage.get(contractNum);
    if(!est){addToast("Could not load estimate","error");return;}
    const jt = est.jobType||"tearoff";
    setClient(est.client||{name:"",title:"",company:"",address:"",city:"Cleveland",state:"OH",zip:"",phone:"",email:""});
    setLastName(est.lastName||""); setHouseNum(est.houseNum||""); setCamLink(est.camLink||"");
    setJobType(jt); setSplit(est.paymentSplit||"33/33/34"); setPaymentStructure(est.paymentStructure||"split");
    setCustomPayments(est.customPayments||[{id:1,label:"Due Now",amount:""},{id:2,label:"Balance Due Upon Completion",amount:""}]);
    setPreparedBy(est.preparedBy||DEFAULT_PREPARED_BY); setPm(est.pm||DEFAULT_PM);
    setDocDate(today()); setTotalPrice(String(est.totalPrice||""));
    setPriceDesc(est.priceDesc||""); setOptItems(est.optItems||[]);
    setScopeItems((est.scopeItems||JOBS[jt].scope).map((t,i)=>({id:i,text:t,on:true})));
    setAdditionalJobs(est.additionalJobs||[]);
    setStatus("Pending"); setMeasurements(est.measurements||{squares:"",pitch:"4/12",layers:"1",decking:"Good"});
    setMaterials(est.materials?.map((t,i)=>({id:i,text:t,on:true}))||[]);
    setNotes(est.notes||""); setIsInsuranceJob(est.isInsuranceJob||false); setInsFields(est.insFields||{insurer:"",claimNum:"",policyNum:"",adjuster:"",dateOfLoss:"",deductible:"",acv:"",rcv:"",depreciation:"",supplementNum:""});
    setClientEmail(est.clientEmail||""); setSignature(null);
    setContractNumber(""); setContractLink(""); setIsSaved(false); setSaveStatus(""); setIsEditing(false);
    setStep(1); setShowPreview(false); setMode("proposal"); setAppMode("form");
    addToast("📋 Estimate duplicated — fill in client details and save","info");
  };

  const handleQuickSaveAndPreview = async () => {
    const e = [];
    if(!client.name.trim()) e.push("Client name is required");
    if(!client.address.trim()) e.push("Property address is required");
    if(baseParsedTotal <= 0) e.push("Total price is required");
    if(e.length > 0){ setValidationErrors(e); addToast("Please fill required fields","error"); return; }
    setValidationErrors([]);
    // Auto-fill scope from job type defaults
    if(scopeItems.filter(s=>s.on).length === 0){
      setScopeItems(JOBS[jobType].scope.map((t,i)=>({id:i,text:t,on:true})));
    }
    // Auto-include all default legal pages
    setFinalPages(p=>p.map(fp=>({...fp,on:true})));
    await handleSaveEstimate();
    setShowPreview(true);
    setStep(5);
  };

  const genBillingNum = () => {
    const yr=new Date().getFullYear();
    const key=`brrg_billing_inv_${yr}`;
    const n=parseInt(localStorage.getItem(key)||"0")+1;
    localStorage.setItem(key,String(n));
    return `BRRG-INV-${yr}-${String(n).padStart(3,"0")}`;
  };
  const loadBillingFromContract = async (contractNum) => {
    if(!contractNum) return;
    const est = await storage.get(contractNum);
    if(!est){ alert("Contract not found."); return; }
    setBInvClient({name:est.client?.name||"",address:est.client?.address||"",city:est.client?.city||""});
    const lines=[];
    if(est.jobType) lines.push({id:Date.now(),desc:JOBS[est.jobType]?.label||est.jobType,amt:String(est.totalPrice||"")});
    (est.additionalJobs||[]).forEach((j,i)=>lines.push({id:Date.now()+i+1,desc:j.desc||JOBS[j.type]?.label||j.type||"",amt:String(j.price||"")}));
    setBInvLines(lines.length>0?lines:[{id:1,desc:"",amt:""}]);
    setBInvContract(contractNum);
  };
  const addBInvLine    = () => setBInvLines(p=>[...p,{id:Date.now(),desc:"",amt:""}]);
  const removeBInvLine = id => setBInvLines(p=>p.length>1?p.filter(l=>l.id!==id):p);
  const updateBInvLine = (id,field,val) => setBInvLines(p=>p.map(l=>l.id===id?{...l,[field]:val}:l));
  const resetBillingInv = () => { setBInvNum(""); setBInvDate(today()); setBInvDueDate("Due upon receipt"); setBInvClient({name:"",address:"",city:""}); setBInvLines([{id:1,desc:"",amt:""}]); setBInvTerms("Due upon receipt."); setBInvMethods("Check, ACH, or other approved method."); setBInvContract(""); setBInvPreview(false); setBInvStatus("Invoiced"); };
  const handleUpdateStatus = async (contractNum, newStatus) => {
    const est = await storage.get(contractNum);
    if(est){ est.status=newStatus; await storage.save(est); setDashboardData(prev=>prev.map(e=>e.contractNumber===contractNum?{...e,status:newStatus}:e)); }
  };

  const previewProps = {
    roofingLogo:ROOFING_LOGO, churchLogo:CHURCH_LOGO, docDate, docType,
    client, job, preparedBy, pm, scopeItems, finalPages,
    totalPrice:baseParsedTotal, priceDesc, optItems, paymentSplit,
    contractNumber, linkedContract:"", isRevised:isEditing&&isSaved,
    additionalJobs, paymentStructure, customPayments,
    signature, signatureTimestamp, signatureIP, status, measurements, materials,
    isInsuranceJob, insFields
  };

  return (
    <div style={S.app}>
      {/* Top Bar */}
      <div style={{background:`linear-gradient(135deg,${NAVY} 0%,${PURPLE_DARK} 100%)`,color:WHITE,padding:isMobile?"10px 12px":"12px 24px",display:"flex",flexDirection:isMobile?"column":"row",alignItems:isMobile?"stretch":"center",justifyContent:"space-between",gap:isMobile?8:16}}>
        {/* Row 1: Logo + Name + Help + Church logo (desktop) */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:isMobile?10:14}}>
            <img src={ROOFING_LOGO} alt="Beshert" style={{height:isMobile?36:48,objectFit:"contain",background:WHITE,borderRadius:4,padding:2,flexShrink:0}}/>
            <div>
              <div style={{fontWeight:700,fontSize:isMobile?13:15,letterSpacing:isMobile?0:1,lineHeight:1.2}}>
                {isMobile?"Beshert Roofing":"BESHERT ROOFING REDEVELOPMENT GROUP"}
              </div>
              {!isMobile&&<div style={{fontSize:11,color:"rgba(255,255,255,0.6)",letterSpacing:2}}>PROPOSAL & INVOICE BUILDER</div>}
              {!isMobile&&<div style={{fontSize:10,color:"rgba(255,255,255,0.5)",marginTop:2}}>📞 {COMPANY.office} · 📱 {COMPANY.mobile} · {COMPANY.email}</div>}
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {!isMobile&&<img src={CHURCH_LOGO} alt="Magnanimous Life" style={{height:48,objectFit:"contain",background:WHITE,borderRadius:4,padding:3}}/>}
            <button onClick={()=>setShowHelp(true)} style={{background:"rgba(255,255,255,0.15)",border:"1.5px solid rgba(255,255,255,0.3)",borderRadius:"50%",width:isMobile?28:32,height:isMobile?28:32,color:"#fff",fontSize:isMobile?13:15,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,lineHeight:1}} title="Help & FAQ">?</button>
          </div>
        </div>
        {/* Row 2: Nav buttons */}
        <div style={{display:"flex",gap:6,flexWrap:isMobile?"nowrap":"wrap",justifyContent:isMobile?"space-between":"flex-start"}}>
          <button onClick={()=>{loadDashboard();setAppMode("dashboard");}} style={{...S.btn(appMode==="dashboard"?GOLD:PURPLE_DARK,appMode==="dashboard"?NAVY:WHITE),textTransform:"uppercase",letterSpacing:1,fontSize:10,padding:"7px 10px",flex:isMobile?1:0}}>📋 {isMobile?"Dash":"Dashboard"}</button>
          {["proposal","invoice"].map(m=>(
            <button key={m} onClick={()=>{setMode(m);setAppMode("form");if(m==="proposal")setProposalMode("quick");if(m==="invoice"&&dashboardData.length===0)loadDashboard();}} style={{...S.btn(mode===m?GOLD:PURPLE_DARK,mode===m?NAVY:WHITE),textTransform:"uppercase",letterSpacing:1,fontSize:10,padding:"7px 10px",flex:isMobile?1:0}}>
              {m==="proposal"?"📄 Proposal":"🧾 Invoice"}
            </button>
          ))}
        </div>
      </div>

      <div style={{maxWidth:920,margin:"0 auto",padding:isMobile?"12px 8px":"24px 16px"}}>

        {hasDraft&&appMode==="form"&&(
          <div style={{background:"#fff9ec",border:`2px solid ${GOLD}`,borderRadius:8,padding:"12px 18px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
            <div style={{fontSize:13,color:"#7a5800"}}>📝 You have an unsaved draft. Resume where you left off?</div>
            <div style={{display:"flex",gap:10}}><button style={S.btn(GOLD,NAVY)} onClick={restoreDraft}>Resume Draft</button><button style={S.btn("#888")} onClick={()=>{setHasDraft(false);localStorage.removeItem(DRAFT_KEY);}}>Discard</button></div>
          </div>
        )}

        {appMode==="dashboard"&&(
          <div>
            <div style={{...S.card,marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
                <div>
                  <div style={{fontWeight:700,fontSize:18,color:PURPLE_DARK}}>📋 Estimates Dashboard</div>
                  <div style={{fontSize:12,color:"#888",marginTop:2}}>{dashboardData.length} estimate{dashboardData.length!==1?"s":""} saved{unsyncedIds.length>0&&<span style={{color:"#e67e22",fontWeight:700}}> · {unsyncedIds.length} unsynced</span>}</div>
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {unsyncedIds.length>0&&<button style={S.btn(isSyncing?"#888":"#e67e22")} onClick={handleSyncUnsynced} disabled={isSyncing}>{isSyncing?"⏳ Syncing…":"☁ Sync "+unsyncedIds.length}</button>}
                  <button style={S.btn(PURPLE_DARK)} onClick={()=>setShowAnalytics(p=>!p)}>{showAnalytics?"Hide":"📊"} Analytics</button>
                  <button style={S.btn(HEADER_BG)} onClick={()=>{resetProposal();setAppMode("form");}}>+ New Estimate</button>
                  <button style={S.btn(PURPLE_DARK)} onClick={loadDashboard}>↻ Refresh</button>
                </div>
              </div>

              {/* Analytics Panel */}
              {showAnalytics && dashboardData.length>0 && (()=>{
                const yr=new Date().getFullYear(), mo=new Date().getMonth();
                const thisMonth=dashboardData.filter(e=>{const d=new Date(e.dateCreated||"");return d.getFullYear()===yr&&d.getMonth()===mo;});
                const pipeline=dashboardData.filter(e=>!["Paid"].includes(e.status||"Pending")).reduce((s,e)=>s+(parseFloat(e.totalPrice)||0),0);
                const avgVal=dashboardData.length?dashboardData.reduce((s,e)=>s+(parseFloat(e.totalPrice)||0),0)/dashboardData.length:0;
                const statusCts=STATUS_OPTIONS.map(s=>({s,n:dashboardData.filter(e=>(e.status||"Pending")===s).length})).filter(x=>x.n>0);
                const jobCts=Object.entries(dashboardData.reduce((acc,e)=>{if(e.jobType&&JOBS[e.jobType])acc[e.jobType]=(acc[e.jobType]||0)+1;return acc;},{})).sort((a,b)=>b[1]-a[1]);
                return (
                  <div style={{marginTop:16,padding:16,background:PURPLE_LIGHT,borderRadius:8,border:`1px solid #d1c9e8`}}>
                    <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:12}}>
                      {[["Total Estimates",dashboardData.length],["This Month",thisMonth.length],["Pipeline Value",fmtAmt(pipeline)],["Avg Estimate",fmtAmt(avgVal)]].map(([lbl,val])=>(
                        <div key={lbl} style={{flex:1,minWidth:120,background:WHITE,borderRadius:6,padding:"10px 14px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
                          <div style={{fontSize:10,color:"#888",textTransform:"uppercase",letterSpacing:1}}>{lbl}</div>
                          <div style={{fontWeight:700,fontSize:16,color:NAVY,marginTop:3}}>{val}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
                      {statusCts.map(({s,n})=><span key={s} style={{background:STATUS_COLORS[s]||"#888",color:"#fff",fontSize:11,fontWeight:700,padding:"2px 10px",borderRadius:12}}>{s}: {n}</span>)}
                    </div>
                    {jobCts.length>0&&<div style={{fontSize:12,color:"#666"}}>Top job: {JOBS[jobCts[0][0]]?.label} ({jobCts[0][1]})</div>}
                  </div>
                );
              })()}
              <div style={{marginTop:16,marginBottom:4}}>
                <input style={{...S.input,maxWidth:320}} placeholder="🔍 Search by name, contract #, address…" value={dashboardSearch} onChange={e=>setDashboardSearch(e.target.value)}/>
              </div>
              <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>{["All",...STATUS_OPTIONS].map(s=>(<button key={s} onClick={()=>setDashboardFilter(s)} style={{...S.btn(dashboardFilter===s?STATUS_COLORS[s]||HEADER_BG:WHITE,dashboardFilter===s?WHITE:PURPLE_DARK),border:`1.5px solid ${dashboardFilter===s?STATUS_COLORS[s]||HEADER_BG:"#d1c9e8"}`,fontSize:11,padding:"5px 14px"}}>{s}</button>))}</div>
            </div>
            {dashboardLoading
              ?<div style={{textAlign:"center",padding:40,color:"#888",fontSize:14}}>⏳ Loading estimates…</div>
              :dashboardData.length===0
                ?<div style={{...S.card,textAlign:"center",padding:48}}><div style={{fontSize:32,marginBottom:12}}>📄</div><div style={{fontSize:15,fontWeight:700,color:PURPLE_DARK,marginBottom:6}}>No estimates yet</div><div style={{fontSize:13,color:"#888",marginBottom:20}}>Create your first estimate to see it here.</div><button style={S.btn(HEADER_BG)} onClick={()=>setAppMode("form")}>+ Create First Estimate</button></div>
                :<div style={{...S.card,padding:0,overflow:"hidden"}}><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5}}><thead><tr style={{background:NAVY}}>{["Contract #","Client","Date","Job","Total","Status"].map(h=>(<th key={h} style={{padding:"10px 14px",textAlign:"left",color:"rgba(255,255,255,0.7)",fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:0.5,whiteSpace:"nowrap"}}>{h}</th>))}</tr></thead><tbody>{dashboardData.filter(e=>{
                              const q=dashboardSearch.toLowerCase();
                              if(q&&![e.contractNumber,e.client?.name,e.client?.address].join(" ").toLowerCase().includes(q))return false;
                              return dashboardFilter==="All"||(e.status||"Pending")===dashboardFilter;
                            }).slice().reverse().map((e,i)=>(<tr key={e.contractNumber} style={{borderBottom:`1px solid ${PURPLE_LIGHT}`,background:i%2===0?"#fff":"#faf9fd",cursor:"pointer",transition:"background 0.15s"}} onClick={()=>{if(e.docType==="billing_invoice"){handleLoadBillingInvoice(e);}else{handleLoadAndPreview(e.contractNumber);}}}><td style={{padding:"10px 14px",fontWeight:700,color:HEADER_BG,fontFamily:"monospace",fontSize:11,whiteSpace:"nowrap"}}>
                                  {e.contractNumber}
                                  {unsyncedIds.includes(e.contractNumber)
                                    ? <span title="Local only" style={{marginLeft:6,fontSize:10}}>📱</span>
                                    : <span title="Synced" style={{marginLeft:6,fontSize:10}}>☁</span>}
                                </td><td style={{padding:"10px 14px",fontWeight:500}}>{e.client?.name||"—"}</td><td style={{padding:"10px 14px",color:"#666",whiteSpace:"nowrap"}}>{e.dateCreated||e.docDate||"—"}</td><td style={{padding:"10px 14px",whiteSpace:"nowrap"}}>{e.docType==="billing_invoice"?"🧾 Billing Invoice":(JOBS[e.jobType]?.icon||"📋")+" "+(JOBS[e.jobType]?.label||"—")}</td><td style={{padding:"10px 14px",fontWeight:700,color:NAVY,whiteSpace:"nowrap"}}>{e.totalPrice?fmtAmt(e.totalPrice):"—"}</td><td style={{padding:"8px 14px",whiteSpace:"nowrap"}} onClick={ev=>ev.stopPropagation()}>
                                  {e.docType!=="billing_invoice"&&<button onClick={ev=>{ev.stopPropagation();handleDuplicateEstimate(e.contractNumber);}} style={{...S.btn(PURPLE_LIGHT,PURPLE_DARK),border:`1px solid #d1c9e8`,fontSize:10,padding:"3px 8px",marginRight:6}}>Duplicate</button>}
                                  <select value={e.status||"Pending"} onChange={ev=>{ev.stopPropagation();handleUpdateStatus(e.contractNumber,ev.target.value);}} style={{background:STATUS_COLORS[e.status||"Pending"]||"#888",color:"#fff",border:"none",borderRadius:12,padding:"3px 9px",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"Georgia,serif"}}>
                                    {STATUS_OPTIONS.map(s=><option key={s} value={s} style={{background:"#fff",color:"#333"}}>{s}</option>)}
                                  </select>
                                </td></tr>))}</tbody></table></div></div>
            }
          </div>
        )}

        {/* ══ PROPOSAL MODE ══ */}
        {mode==="proposal" && (
          <>
            {!showPreview && (
              <div style={{...S.card,padding:"14px 20px"}}>
                {/* Mode Toggle */}
                <div style={{display:"flex",gap:8,marginBottom:proposalMode==="full"?14:0,flexWrap:"wrap",alignItems:"center"}}>
                  <button onClick={()=>setProposalMode("quick")} style={{...S.btn(proposalMode==="quick"?"#27ae60":WHITE,proposalMode==="quick"?WHITE:PURPLE_DARK),border:`2px solid ${proposalMode==="quick"?"#27ae60":"#d1c9e8"}`,fontSize:12,padding:"6px 16px"}}>🚀 Quick Estimate</button>
                  <button onClick={()=>setProposalMode("full")} style={{...S.btn(proposalMode==="full"?HEADER_BG:WHITE,proposalMode==="full"?WHITE:PURPLE_DARK),border:`2px solid ${proposalMode==="full"?HEADER_BG:"#d1c9e8"}`,fontSize:12,padding:"6px 16px"}}>📋 Full Estimate</button>
                  <div style={{marginLeft:"auto",display:"flex",gap:8,flexWrap:"wrap"}}>
                    {isEditing && <span style={{...S.tag(GOLD),fontSize:11,padding:"4px 10px"}}>✏️ Editing: {contractNumber}</span>}
                    <button onClick={resetProposal} style={S.btn("#888")}>{isEditing?"Cancel Edit":"New"}</button>
                  </div>
                </div>
                {proposalMode==="full" && <div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>
                  {[["1","Project Setup"],["2","Scope of Work"],["3","Legal Pages"],["4","Pricing"],["5","Save & Preview"]].map(([n,lbl])=>(
                    <button key={n} style={S.stepBtn(step===Number(n))} onClick={()=>{setShowPreview(false);setStep(Number(n));}}>{n}. {lbl}</button>
                  ))}
                  <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                    {isEditing && <span style={{...S.tag(GOLD),fontSize:11,padding:"4px 10px"}}>✏️ Editing: {contractNumber}</span>}
                    <span style={S.tag(docType==="invoice"?"#e8a020":PURPLE)}>{docType.toUpperCase()}</span>
                    <button onClick={()=>setDocType(d=>d==="estimate"?"invoice":"estimate")} style={S.btn(NAVY)}>
                      Switch to {docType==="estimate"?"Invoice":"Estimate"}
                    </button>
                    <button onClick={resetProposal} style={S.btn("#888")}>{isEditing?"Cancel Edit":"New Estimate"}</button>
                  </div>
                </div>}
              </div>
            )}

            {/* ══ QUICK ESTIMATE FORM ══ */}
            {!showPreview && proposalMode==="quick" && (
              <div style={S.card}>
                <div style={{fontWeight:700,fontSize:16,color:PURPLE_DARK,marginBottom:4}}>🚀 Quick Estimate</div>
                <div style={{fontSize:12,color:"#888",marginBottom:20}}>Fill in the essentials — save and preview in seconds. Add full scope, legal pages, and details anytime using Full Estimate view.</div>
                <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14,marginBottom:14}}>
                  <div><label style={S.label}>Client Name *</label><input style={S.input} placeholder="Full name" value={client.name} onChange={e=>setClient(p=>({...p,name:e.target.value}))}/></div>
                  <div><label style={S.label}>Property Address *</label><input style={S.input} placeholder="Street address" value={client.address} onChange={e=>setClient(p=>({...p,address:e.target.value}))}/></div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:14,marginBottom:14}}>
                  <div><label style={S.label}>City</label><input style={S.input} placeholder="Cleveland" value={client.city} onChange={e=>setClient(p=>({...p,city:e.target.value}))}/></div>
                  <div><label style={S.label}>ZIP</label><input style={S.input} placeholder="44102" value={client.zip||""} onChange={e=>setClient(p=>({...p,zip:e.target.value}))}/></div>
                  <div><label style={S.label}>Phone</label><input style={S.input} placeholder="(216) 000-0000" value={client.phone||""} onChange={e=>setClient(p=>({...p,phone:formatPhone(e.target.value)}))}/></div>
                  <div><label style={S.label}>Date</label><input style={S.input} value={docDate} onChange={e=>setDocDate(e.target.value)}/></div>
                </div>
                <div style={{marginBottom:14}}>
                  <label style={S.label}>Job Type *</label>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:6}}>
                    {Object.entries(JOBS).map(([key,job])=>(
                      <button key={key} onClick={()=>{setJobType(key);setScopeItems(job.scope.map((t,i)=>({id:i,text:t,on:true})));}} style={{...S.btn(jobType===key?job.color||HEADER_BG:WHITE,jobType===key?WHITE:PURPLE_DARK),border:`2px solid ${jobType===key?job.color||HEADER_BG:"#d1c9e8"}`,padding:"8px 14px",fontSize:12}}>
                        {job.icon} {job.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14,marginBottom:14}}>
                  <div>
                    <label style={S.label}>Total Price *</label>
                    <div style={{display:"flex",alignItems:"center"}}>
                      <span style={{background:PURPLE_LIGHT,border:"1.5px solid #d1c9e8",borderRight:"none",borderRadius:"6px 0 0 6px",padding:"9px 12px",fontSize:13,fontWeight:700,color:PURPLE_DARK}}>$</span>
                      <input style={{...S.input,borderRadius:"0 6px 6px 0"}} placeholder="0.00" value={totalPrice} onChange={e=>setTotalPrice(e.target.value)}/>
                    </div>
                  </div>
                  <div>
                    <label style={S.label}>Payment Split</label>
                    <div style={{display:"flex",gap:8,marginTop:6}}>
                      {["50/50","33/33/34"].map(s=>(<button key={s} onClick={()=>setSplit(s)} style={{...S.btn(paymentSplit===s?HEADER_BG:WHITE,paymentSplit===s?WHITE:PURPLE_DARK),border:`2px solid ${paymentSplit===s?HEADER_BG:"#d1c9e8"}`,fontSize:12,padding:"8px 14px"}}>{s}</button>))}
                    </div>
                  </div>
                </div>
                <div style={{marginBottom:14}}>
  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
    <label style={S.label}>Internal Notes <span style={{fontWeight:400,color:"#888"}}>(not printed)</span></label>
    <button onClick={()=>startListening(t=>setNotes(p=>p?p+" "+t:t))} style={{...S.btn(isListening?"#e74c3c":"#888"),fontSize:10,padding:"3px 10px"}}>{isListening?"🔴 Listening…":"🎤 Voice"}</button>
  </div>
  <input style={S.input} placeholder="e.g. call after 3pm · gate code 1234" value={notes} onChange={e=>setNotes(e.target.value)}/>
</div>
                {/* Measurement Strip */}
                <div style={{...S.card,background:"#f8f7fb",border:`1px solid ${PURPLE_LIGHT}`,marginBottom:14}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                    <div style={{fontWeight:700,fontSize:14,color:PURPLE_DARK}}>📐 Roof Measurements</div>
                    <div style={{fontSize:11,color:"#888",fontStyle:"italic"}}>From HoverApp, EagleView, or manual measurement</div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr 1fr",gap:10,marginBottom:10}}>
                    <div>
                      <label style={S.label}>Squares</label>
                      <input style={S.input} type="number" placeholder="e.g. 22" value={measurements.squares} onChange={e=>setMeasurements(p=>({...p,squares:e.target.value}))}/>
                    </div>
                    <div>
                      <label style={S.label}>Pitch</label>
                      <select style={S.input} value={measurements.pitch} onChange={e=>setMeasurements(p=>({...p,pitch:e.target.value}))}>
                        {["3/12","4/12","5/12","6/12","7/12","8/12","9/12","10/12","12/12"].map(p=><option key={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={S.label}>Layers</label>
                      <select style={S.input} value={measurements.layers} onChange={e=>setMeasurements(p=>({...p,layers:e.target.value}))}>
                        {["1","2","3+"].map(l=><option key={l}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={S.label}>Decking</label>
                      <select style={S.input} value={measurements.decking} onChange={e=>setMeasurements(p=>({...p,decking:e.target.value}))}>
                        {["Good","Fair","Poor","Unknown"].map(d=><option key={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>
                  {measurements.squares && parseFloat(measurements.squares) > 0 && (
                    <div style={{background:"#fffbe8",border:"1px solid #f0d080",borderRadius:6,padding:"8px 12px",fontSize:12,color:"#7a5800"}}>
                      💡 <strong>{measurements.squares} squares</strong> of {JOBS[jobType]?.label||"roofing"} — typical Cleveland range:
                      <strong> {new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(parseFloat(measurements.squares)*350)}</strong> –
                      <strong> {new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(parseFloat(measurements.squares)*500)}</strong>
                    </div>
                  )}
                </div>

                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,padding:"10px 14px",background:"#fafafa",borderRadius:8,border:`1px solid #e2e8f0`}}>
                  <span style={{fontSize:12,color:"#666"}}>⚡ Insurance claim?</span>
                  <button onClick={()=>setIsInsuranceJob(p=>!p)} style={{...S.btn(isInsuranceJob?"#C9A84C":WHITE,isInsuranceJob?NAVY:PURPLE_DARK),border:`2px solid ${isInsuranceJob?"#C9A84C":"#d1c9e8"}`,padding:"5px 14px",fontSize:11}}>{isInsuranceJob?"✓ Yes":"No"}</button>
                  {isInsuranceJob&&<span style={{fontSize:11,color:"#888"}}>Add claim details in Full Estimate → Step 1</span>}
                </div>
                {validationErrors.length>0&&(<div style={{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:8,padding:"12px 16px",marginBottom:14}}>{validationErrors.map((e,i)=><div key={i} style={{fontSize:12,color:"#c0392b"}}>⚠ {e}</div>)}</div>)}
                <div style={{display:"flex",gap:10,justifyContent:"space-between",flexWrap:"wrap"}}>
                  <button style={S.btn(PURPLE_DARK)} onClick={()=>setProposalMode("full")}>📋 Switch to Full Estimate →</button>
                  <button className={hasUnsavedData?"save-pulse":""} style={{...S.btn(saveStatus==="saving"?"#888":isSaved?"#159c59":"#27ae60"),minWidth:180,transition:"all 0.3s"}} onClick={handleQuickSaveAndPreview} disabled={saveStatus==="saving"}>{saveStatus==="saving"?"⏳ Saving…":isSaved?"✓ Saved":"🚀 Save & Preview →"}</button>
                </div>
              </div>
            )}

            {/* STEPS (Full Estimate mode only) */}
            {proposalMode==="full" && !showPreview && step===1 && (
              <>
                <div style={S.card}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{fontWeight:700,fontSize:14,color:PURPLE_DARK}}>
                      {isEditing ? `✏️ Editing: ${contractNumber}` : "Load & Edit an Existing Estimate"}
                    </div>
                    {!isEditing && (
                      <button onClick={()=>{setShowLoadPanel(!showLoadPanel);setLoadEditError("");}} style={S.btn(showLoadPanel?"#888":HEADER_BG)}>
                        {showLoadPanel?"✕ Cancel":"📂 Load & Edit"}
                      </button>
                    )}
                    {isEditing && (
                      <button onClick={resetProposal} style={S.btn("#888")}>Cancel Edit → New Estimate</button>
                    )}
                  </div>
                  {showLoadPanel && !isEditing && (
                    <div style={{marginTop:16}}>
                      {loadEditError && <div style={{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:6,padding:"10px 14px",fontSize:12,color:"#c0392b",marginBottom:12}}>{loadEditError}</div>}
                      {recentEsts.length>0 && (
                        <div style={{marginBottom:12}}>
                          <label style={S.label}>Select from Recent Estimates</label>
                          <select style={S.input} onChange={e=>e.target.value&&handleLoadForEdit(e.target.value)} defaultValue="">
                            <option value="">— Choose an estimate to edit —</option>
                            {recentEsts.slice().reverse().map(e=>(
                              <option key={e.contractNumber} value={e.contractNumber}>{e.contractNumber} · {e.client?.name||"No name"} · {e.dateCreated}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <label style={S.label}>Or Enter Contract Number Manually</label>
                      <div style={{display:"flex",gap:10}}>
                        <input style={{...S.input,flex:1}} placeholder="e.g. BRRG-EST-2026-001" value={loadEditInput} onChange={e=>setLoadEditInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLoadForEdit()}/>
                        <button style={S.btn(HEADER_BG)} onClick={()=>handleLoadForEdit()}>Load</button>
                      </div>
                    </div>
                  )}
                  {isEditing && (
                    <div style={{marginTop:10,background:"#fff9ec",border:`1px solid ${GOLD}44`,borderRadius:6,padding:"10px 14px",fontSize:12,color:"#7a5800"}}>
                      You are editing an existing estimate. Saving will update the original record and mark the document <strong>REVISED</strong>.
                    </div>
                  )}
                </div>

                <div style={S.card}>
                  <div style={{fontWeight:700,fontSize:14,marginBottom:14,color:PURPLE_DARK}}>Job Type</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))",gap:10}}>
                    {Object.entries(JOBS).map(([key,j])=>(
                      <button key={key} onClick={()=>switchJob(key)} style={{background:jobType===key?j.color:WHITE,color:jobType===key?WHITE:TEXT,border:`2px solid ${jobType===key?j.color:"#d1c9e8"}`,borderRadius:8,padding:"12px 10px",cursor:"pointer",textAlign:"center",fontFamily:"Georgia,serif",transition:"all .15s"}}>
                        <div style={{fontSize:22}}>{j.icon}</div>
                        <div style={{fontWeight:700,fontSize:12,marginTop:4}}>{j.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div style={S.card}>
                  <div style={{fontWeight:700,fontSize:14,marginBottom:4,color:PURPLE_DARK}}>Client Information</div>
                  <div style={{fontSize:11,color:"#888",marginBottom:14}}>Last Name and Property # are used to generate the contract number (e.g. BRRG-EST-2026-001-JOHNSON-4521)</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginBottom:14,padding:"14px",background:PURPLE_LIGHT,borderRadius:8,border:`1px solid #d1c9e8`}}>
                    <div>
                      <label style={S.label}>Last Name (for contract #)</label>
                      <input style={S.input} placeholder="e.g. Johnson" value={lastName} onChange={e=>setLastName(e.target.value)}/>
                    </div>
                    <div>
                      <label style={S.label}>House / Property # (for contract #)</label>
                      <input style={S.input} placeholder="e.g. 4521" value={houseNum} onChange={e=>setHouseNum(e.target.value)}/>
                    </div>
                    <div>
                      <label style={S.label}>📷 CompanyCam Project Link</label>
                      <input style={S.input} placeholder="https://app.companycam.com/..." value={camLink} onChange={e=>setCamLink(e.target.value)}/>
                    </div>
                    {(lastName||houseNum) && (
                      <div style={{gridColumn:"1/-1",fontSize:12,color:PURPLE_DARK}}>
                        Contract # preview: <strong>BRRG-EST-{new Date().getFullYear()}-###
                        {lastName?`-${lastName.toUpperCase().replace(/[^A-Z0-9]/gi,"")}`:""}{houseNum?`-${houseNum}`:""}</strong>
                      </div>
                    )}
                    {camLink && (
                      <div style={{gridColumn:"1/-1",fontSize:12}}>
                        <a href={camLink} target="_blank" rel="noreferrer" style={{color:HEADER_BG,fontWeight:600}}>📷 Open CompanyCam Project →</a>
                      </div>
                    )}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                    {(isMobile?[["name","Full Name"],["address","Property Address"],["city","City"],["state","State"],["zip","ZIP"],["phone","Phone"],["email","Email"],["title","Title"],["company","Company"]]:[["name","Full Name"],["title","Title / Salutation"],["company","Organization / Company"],["address","Property Address"],["city","City"],["state","State"],["zip","ZIP"],["phone","Phone"],["email","Email"]]).map(([k,lbl])=>(
                      <div key={k} style={k==="company"||k==="address"?{gridColumn:"1/-1"}:{}}>
                        <label style={S.label}>{lbl}</label>
                        <input style={S.input} placeholder={k==="title"?"e.g. Mr., Mrs., Dr.":""} value={client[k]} onChange={e=>setClient(p=>({...p,[k]:k==="phone"?formatPhone(e.target.value):e.target.value}))}/>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={S.card}>
                  <div style={{fontWeight:700,fontSize:14,marginBottom:14,color:PURPLE_DARK}}>Document Details</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
                    <div><label style={S.label}>Date</label><input style={S.input} value={docDate} onChange={e=>setDocDate(e.target.value)}/></div>
                    <div><label style={S.label}>Prepared By</label><input style={S.input} value={preparedBy} onChange={e=>setPreparedBy(e.target.value)}/></div>
                    <div><label style={S.label}>Project Manager</label><input style={S.input} value={pm} onChange={e=>setPm(e.target.value)}/></div>
                  </div>
                </div>
                <div style={S.card}>
                  <div style={{fontWeight:700,fontSize:14,marginBottom:14,color:PURPLE_DARK}}>📐 Roof Measurements <span style={{fontWeight:400,fontSize:12,color:"#888"}}>(reference only — stored with estimate)</span></div>
                  <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr 1fr",gap:14}}>
                    <div><label style={S.label}>Squares</label><input style={S.input} type="number" placeholder="e.g. 22" value={measurements.squares} onChange={e=>setMeasurements(p=>({...p,squares:e.target.value}))}/></div>
                    <div><label style={S.label}>Pitch</label><select style={S.input} value={measurements.pitch} onChange={e=>setMeasurements(p=>({...p,pitch:e.target.value}))}>{["2/12","3/12","4/12","5/12","6/12","7/12","8/12","9/12","10/12","11/12","12/12","14/12+"].map(p=><option key={p}>{p}</option>)}</select></div>
                    <div><label style={S.label}>Layers</label><select style={S.input} value={measurements.layers} onChange={e=>setMeasurements(p=>({...p,layers:e.target.value}))}><option value="1">1 Layer</option><option value="2">2 Layers</option></select></div>
                    <div><label style={S.label}>Decking Condition</label><select style={S.input} value={measurements.decking} onChange={e=>setMeasurements(p=>({...p,decking:e.target.value}))}>{["Good","Fair","Needs Replacement"].map(d=><option key={d}>{d}</option>)}</select></div>
                  </div>
                </div>
                {/* Insurance Job Toggle */}
                <div style={S.card}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:14,color:PURPLE_DARK}}>⚡ Insurance Claim Job</div>
                      <div style={{fontSize:12,color:"#888",marginTop:2}}>Toggle on to add claim details to this estimate</div>
                    </div>
                    <button onClick={()=>setIsInsuranceJob(p=>!p)} style={{...S.btn(isInsuranceJob?"#C9A84C":WHITE,isInsuranceJob?NAVY:PURPLE_DARK),border:`2px solid ${isInsuranceJob?"#C9A84C":"#d1c9e8"}`,padding:"8px 20px",fontSize:13,fontWeight:700}}>
                      {isInsuranceJob?"✓ Insurance Job":"Insurance Job"}
                    </button>
                  </div>
                  {isInsuranceJob && (
                    <div style={{marginTop:16,borderTop:`1px solid #e8d080`,paddingTop:16}}>
                      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12,marginBottom:12}}>
                        <div><label style={S.label}>Insurance Company</label><input style={S.input} placeholder="e.g. State Farm" value={insFields.insurer} onChange={e=>setInsFields(p=>({...p,insurer:e.target.value}))}/></div>
                        <div><label style={S.label}>Claim Number</label><input style={S.input} placeholder="Claim #" value={insFields.claimNum} onChange={e=>setInsFields(p=>({...p,claimNum:e.target.value}))}/></div>
                        <div><label style={S.label}>Policy Number</label><input style={S.input} placeholder="Policy #" value={insFields.policyNum} onChange={e=>setInsFields(p=>({...p,policyNum:e.target.value}))}/></div>
                        <div><label style={S.label}>Adjuster Name</label><input style={S.input} placeholder="Adjuster name" value={insFields.adjuster} onChange={e=>setInsFields(p=>({...p,adjuster:e.target.value}))}/></div>
                        <div><label style={S.label}>Date of Loss</label><input style={S.input} placeholder="MM/DD/YYYY" value={insFields.dateOfLoss} onChange={e=>setInsFields(p=>({...p,dateOfLoss:e.target.value}))}/></div>
                        <div><label style={S.label}>Supplement # (if applicable)</label><input style={S.input} placeholder="e.g. 1" value={insFields.supplementNum} onChange={e=>setInsFields(p=>({...p,supplementNum:e.target.value}))}/></div>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr 1fr",gap:12}}>
                        <div><label style={S.label}>Deductible ($)</label><input style={S.input} placeholder="0.00" value={insFields.deductible} onChange={e=>setInsFields(p=>({...p,deductible:e.target.value}))}/></div>
                        <div><label style={S.label}>ACV ($)</label><input style={S.input} placeholder="Approved amt" value={insFields.acv} onChange={e=>setInsFields(p=>({...p,acv:e.target.value}))}/></div>
                        <div><label style={S.label}>RCV ($)</label><input style={S.input} placeholder="Full replacement" value={insFields.rcv} onChange={e=>setInsFields(p=>({...p,rcv:e.target.value}))}/></div>
                        <div><label style={S.label}>Depreciation ($)</label><input style={S.input} placeholder="Holdback" value={insFields.depreciation} onChange={e=>setInsFields(p=>({...p,depreciation:e.target.value}))}/></div>
                      </div>
                      {(insFields.acv||insFields.rcv||insFields.deductible) && (
                        <div style={{marginTop:14,padding:"10px 14px",background:"#fffbe8",border:"1px solid #f0d080",borderRadius:6}}>
                          <div style={{fontSize:11,fontWeight:700,color:"#7a5800",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Auto-Calculated</div>
                          <div style={{display:"flex",gap:20,flexWrap:"wrap",fontSize:12}}>
                            {insFields.acv&&insFields.deductible&&<div><span style={{color:"#888"}}>Expected insurance check: </span><strong>{fmtAmt(Math.max(0,parseFloat(insFields.acv||0)-parseFloat(insFields.deductible||0)))}</strong></div>}
                            {insFields.rcv&&insFields.acv&&<div><span style={{color:"#888"}}>Supplement target: </span><strong>{fmtAmt(Math.max(0,parseFloat(insFields.rcv||0)-parseFloat(insFields.acv||0)))}</strong></div>}
                            {insFields.deductible&&<div><span style={{color:"#888"}}>Client out-of-pocket: </span><strong>{fmtAmt(parseFloat(insFields.deductible||0))}</strong></div>}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Internal Notes */}
                <div style={S.card}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                    <div style={{fontWeight:700,fontSize:14,color:PURPLE_DARK}}>📝 Internal Notes <span style={{fontWeight:400,fontSize:11,color:"#888"}}>— not printed</span></div>
                    <button onClick={()=>startListening(t=>setNotes(p=>p?p+" "+t:t))} style={{...S.btn(isListening?"#e74c3c":"#888"),fontSize:10,padding:"4px 12px"}}>{isListening?"🔴 Listening…":"🎤 Voice"}</button>
                  </div>
                  <textarea style={{...S.input,height:80,resize:"vertical",fontFamily:"Georgia,serif"}} placeholder="e.g. Homeowner prefers calls after 3pm · Adjuster is difficult · Gate code 1234" value={notes} onChange={e=>setNotes(e.target.value)}/>
                </div>

                {validationErrors.length>0&&(<div style={{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:8,padding:"12px 16px",marginBottom:8}}>{validationErrors.map((e,i)=><div key={i} style={{fontSize:12,color:"#c0392b"}}>⚠ {e}</div>)}</div>)}
                <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:10}}><button style={S.btn("#888")} onClick={()=>setProposalMode("quick")}>← Back to Quick</button><button style={S.btn(HEADER_BG)} onClick={()=>setStep(2)}>Next: Scope of Work →</button></div>
              </>
            )}

            {proposalMode==="full" && !showPreview && step===2 && (
              <>
                <div style={S.card}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                    <div style={{fontWeight:700,fontSize:14,color:PURPLE_DARK}}>Scope of Work — {job.label}</div>
                    <span style={S.tag(job.color)}>{job.icon} {job.label}</span>
                  </div>
                  <div style={{fontSize:12,color:"#888",marginBottom:14}}>Check/uncheck items to include or exclude. Click text to edit.</div>
                  {scopeItems.map(s=>(
                    <div key={s.id} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"7px 0",borderBottom:`1px solid ${PURPLE_LIGHT}`}}>
                      <input type="checkbox" checked={s.on} onChange={()=>toggleScope(s.id)} style={{marginTop:3,accentColor:HEADER_BG,width:16,height:16,flexShrink:0}}/>
                      <input value={s.text} onChange={e=>editScope(s.id,e.target.value)} style={{...S.input,opacity:s.on?1:0.4,border:"none",padding:"2px 0",fontSize:12.5,background:"transparent"}}/>
                      <button onClick={()=>removeScope(s.id)} style={{background:"none",border:"none",color:"#ccc",cursor:"pointer",fontSize:16,flexShrink:0}}>✕</button>
                    </div>
                  ))}
                  <div style={{display:"flex",gap:10,marginTop:14}}>
                    <input style={{...S.input,flex:1}} placeholder="Add custom scope item…" value={newScope} onChange={e=>setNewScope(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addScope()}/>
                    <button style={S.btn(HEADER_BG)} onClick={addScope}>+ Add</button>
                  </div>
                </div>
                <div style={S.card}>
                  <div style={{fontWeight:700,fontSize:14,marginBottom:4,color:PURPLE_DARK}}>🧱 Materials Specified</div>
                  <div style={{fontSize:12,color:"#888",marginBottom:14}}>List materials, brands, and specs. Saved to your library for quick reuse.</div>
                  {materialLibrary.length>0&&(<div style={{marginBottom:12}}><div style={{fontSize:11,color:"#888",marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>Library — tap to add:</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{materialLibrary.map((item,i)=>(<button key={i} onClick={()=>setNewMaterialText(item)} style={{background:PURPLE_LIGHT,border:`1px solid ${PURPLE}33`,borderRadius:20,padding:"4px 12px",fontSize:11,cursor:"pointer",color:PURPLE_DARK,fontFamily:"Georgia,serif"}}>{item}</button>))}</div></div>)}
                  {materials.map(m=>(<div key={m.id} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0",borderBottom:`1px solid ${PURPLE_LIGHT}`}}><input type="checkbox" checked={m.on} onChange={()=>toggleMaterial(m.id)} style={{accentColor:HEADER_BG,width:15,height:15,flexShrink:0}}/><input value={m.text} onChange={e=>editMaterial(m.id,e.target.value)} style={{...S.input,border:"none",padding:"2px 0",fontSize:12.5,background:"transparent",opacity:m.on?1:0.4,flex:1}}/><button onClick={()=>removeMaterial(m.id)} style={{background:"none",border:"none",color:"#ccc",cursor:"pointer",fontSize:16,flexShrink:0}}>✕</button></div>))}
                  <div style={{display:"flex",gap:10,marginTop:12}}><input style={{...S.input,flex:1}} placeholder="e.g. GAF Timberline HDZ — Charcoal" value={newMaterialText} onChange={e=>setNewMaterialText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addMaterial()}/><button style={S.btn(HEADER_BG)} onClick={addMaterial}>+ Add</button></div>
                </div>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <button style={S.btn(PURPLE_DARK)} onClick={()=>setStep(1)}>← Back</button>
                  <button style={S.btn(HEADER_BG)} onClick={()=>setStep(3)}>Next: Legal Pages →</button>
                </div>
              </>
            )}

            {proposalMode==="full" && !showPreview && step===3 && (
              <>
                <div style={S.card}>
                  <div style={{fontWeight:700,fontSize:14,color:PURPLE_DARK,marginBottom:14}}>Legal Pages</div>
                  <div style={{fontSize:12,color:"#888",marginBottom:14}}>Toggle which provisions appear in the final document.</div>
                  {finalPages.map(fp=>(
                    <div key={fp.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:`1px solid ${PURPLE_LIGHT}`}}>
                      <input type="checkbox" checked={fp.on} onChange={()=>toggleFP(fp.id)} style={{accentColor:HEADER_BG,width:16,height:16,flexShrink:0}}/>
                      <span style={{fontSize:12.5,color:fp.on?TEXT:"#aaa"}}>{fp.label}</span>
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <button style={S.btn(PURPLE_DARK)} onClick={()=>setStep(2)}>← Back</button>
                  <button style={S.btn(HEADER_BG)} onClick={()=>setStep(4)}>Next: Pricing →</button>
                </div>
              </>
            )}

            {/* STEP 4 — Pricing (HEAVILY MODIFIED) */}
            {proposalMode==="full" && !showPreview && step===4 && (
              <>
                <div style={S.card}>
                  <div style={{fontWeight:700,fontSize:14,color:PURPLE_DARK,marginBottom:20}}>Pricing</div>

                  {/* Primary Job Price */}
                  <div style={{marginBottom:20}}>
                    <label style={S.label}>Primary Job Price — {job.label}</label>
                    <div style={{display:"flex",alignItems:"center"}}>
                      <span style={{background:PURPLE_LIGHT,border:"1.5px solid #d1c9e8",borderRight:"none",borderRadius:"6px 0 0 6px",padding:"9px 14px",fontSize:16,fontWeight:700,color:PURPLE_DARK}}>$</span>
                      <input style={{...S.input,borderRadius:"0 6px 6px 0",fontSize:16,fontWeight:700}} placeholder="0.00" value={totalPrice} onChange={e=>setTotalPrice(e.target.value)}/>
                    </div>
                  </div>

                  {/* Additional Job Line Items — each with scope (NEW) */}
                  <div style={{marginBottom:20,padding:16,background:PURPLE_LIGHT,borderRadius:8,border:`1px solid #d1c9e8`}}>
                    <div style={{fontWeight:700,fontSize:12,color:PURPLE_DARK,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Additional Job Line Items</div>
                    <div style={{fontSize:12,color:"#666",marginBottom:12}}>Each job prints with its own scope of work and price. Scope auto-fills from job type — you can edit it inline.</div>

                    {additionalJobs.map((j,i)=>(
                      <div key={j.id||i} style={{marginBottom:10,border:`1px solid #d1c9e8`,borderRadius:8,overflow:"hidden"}}>
                        {/* Job header row */}
                        <div style={{display:"grid",gridTemplateColumns:"170px 1fr 130px auto auto",gap:8,alignItems:"center",padding:"10px 12px",background:WHITE}}>
                          <select style={S.input} value={j.type} onChange={e=>{
                            const jt=e.target.value;
                            setAdditionalJobs(p=>p.map(x=>x.id===j.id?{...x,type:jt,scopeItems:JOBS[jt].scope.map((text,idx2)=>({id:Date.now()+idx2,text,on:true}))}:x));
                          }}>
                            {Object.entries(JOBS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                          </select>
                          <input style={S.input} placeholder="Description (optional)" value={j.desc||""} onChange={e=>setAdditionalJobs(p=>p.map(x=>x.id===j.id?{...x,desc:e.target.value}:x))}/>
                          <div style={{display:"flex",alignItems:"center"}}>
                            <span style={{background:PURPLE_LIGHT,border:"1.5px solid #d1c9e8",borderRight:"none",borderRadius:"6px 0 0 6px",padding:"9px 8px",fontSize:12,fontWeight:700,color:PURPLE_DARK}}>$</span>
                            <input style={{...S.input,borderRadius:"0 6px 6px 0"}} placeholder="0.00" value={j.price||""} onChange={e=>setAdditionalJobs(p=>p.map(x=>x.id===j.id?{...x,price:e.target.value}:x))}/>
                          </div>
                          <button
                            onClick={()=>setExpandedJobScopes(p=>({...p,[j.id]:!p[j.id]}))}
                            style={{...S.btn(expandedJobScopes[j.id]?HEADER_BG:PURPLE_LIGHT,expandedJobScopes[j.id]?WHITE:PURPLE_DARK),border:`1px solid ${expandedJobScopes[j.id]?HEADER_BG:"#d1c9e8"}`,padding:"8px 10px",fontSize:11,whiteSpace:"nowrap"}}
                          >
                            📋 Scope {expandedJobScopes[j.id]?"▲":"▼"}
                          </button>
                          <button onClick={()=>removeAdditionalJob(j.id)} style={{background:"none",border:"none",color:"#c0392b",cursor:"pointer",fontSize:18,fontWeight:700,padding:"0 4px"}}>✕</button>
                        </div>

                        {/* Expandable scope editor */}
                        {expandedJobScopes[j.id] && (
                          <div style={{padding:"12px 14px",background:"#fafaf8",borderTop:`1px solid #e8e4f0`}}>
                            <div style={{fontSize:11,fontWeight:700,color:PURPLE_DARK,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>
                              Scope for {j.desc||JOBS[j.type]?.label||j.type}
                            </div>
                            {(j.scopeItems||[]).map(s=>(
                              <div key={s.id} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"5px 0",borderBottom:`1px solid ${PURPLE_LIGHT}`}}>
                                <input type="checkbox" checked={s.on} onChange={()=>toggleAdditionalJobScope(j.id,s.id)} style={{marginTop:3,accentColor:HEADER_BG,width:15,height:15,flexShrink:0}}/>
                                <input value={s.text} onChange={e=>editAdditionalJobScopeText(j.id,s.id,e.target.value)} style={{...S.input,border:"none",padding:"2px 0",fontSize:12,background:"transparent",opacity:s.on?1:0.4}}/>
                                <button onClick={()=>removeAdditionalJobScopeItem(j.id,s.id)} style={{background:"none",border:"none",color:"#ccc",cursor:"pointer",fontSize:14,flexShrink:0}}>✕</button>
                              </div>
                            ))}
                            <div style={{display:"flex",gap:8,marginTop:10}}>
                              <input
                                style={{...S.input,flex:1,fontSize:12}}
                                placeholder="Add custom scope item…"
                                value={newJobScopeTexts[j.id]||""}
                                onChange={e=>setNewJobScopeTexts(p=>({...p,[j.id]:e.target.value}))}
                                onKeyDown={e=>e.key==="Enter"&&addAdditionalJobScopeItem(j.id)}
                              />
                              <button style={S.btn(HEADER_BG)} onClick={()=>addAdditionalJobScopeItem(j.id)}>+ Add</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Add new job row */}
                    <div style={{display:"grid",gridTemplateColumns:"170px 1fr 130px auto",gap:8,alignItems:"center",marginTop:4}}>
                      <select style={S.input} value={newJobType} onChange={e=>setNewJobType(e.target.value)}>
                        {Object.entries(JOBS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                      </select>
                      <input style={S.input} placeholder="Description (optional)" value={newJobDesc} onChange={e=>setNewJobDesc(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addAdditionalJob()}/>
                      <div style={{display:"flex",alignItems:"center"}}>
                        <span style={{background:PURPLE_LIGHT,border:"1.5px solid #d1c9e8",borderRight:"none",borderRadius:"6px 0 0 6px",padding:"9px 8px",fontSize:12,fontWeight:700,color:PURPLE_DARK}}>$</span>
                        <input style={{...S.input,borderRadius:"0 6px 6px 0"}} placeholder="0.00" value={newJobPrice} onChange={e=>setNewJobPrice(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addAdditionalJob()}/>
                      </div>
                      <button style={S.btn(HEADER_BG)} onClick={addAdditionalJob}>+ Add Job</button>
                    </div>
                    <div style={{fontSize:11,color:"#888",marginTop:8}}>After adding, click <strong>📋 Scope</strong> on each job to review and edit its scope items.</div>

                    {addJobsTotal > 0 && (
                      <div style={{marginTop:12,padding:"8px 12px",background:NAVY,borderRadius:6,display:"flex",justifyContent:"space-between",fontSize:13,color:WHITE}}>
                        <span>Grand Total (all jobs)</span>
                        <span style={{fontWeight:700,color:GOLD}}>{fmtAmt(parsedTotal)}</span>
                      </div>
                    )}
                  </div>

                  {/* Status */}
                  <div style={{marginBottom:20}}><label style={S.label}>Job Status</label><div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:6}}>{STATUS_OPTIONS.map(s=>(<button key={s} onClick={()=>setStatus(s)} style={{...S.btn(status===s?STATUS_COLORS[s]||HEADER_BG:WHITE,status===s?WHITE:PURPLE_DARK),border:`2px solid ${status===s?STATUS_COLORS[s]||HEADER_BG:"#d1c9e8"}`,padding:"7px 16px",fontSize:12}}>{s}</button>))}</div></div>
                  {/* Payment Structure (NEW) */}
                  <div style={{marginBottom:20,padding:16,background:"#f8f7fb",borderRadius:8,border:`1px solid #d1c9e8`}}>
                    <div style={{fontWeight:700,fontSize:12,color:PURPLE_DARK,textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>Payment Structure</div>
                    <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
                      {[["split","Split Payment"],["due_now","Due Now (Full)"],["custom","Custom Terms"]].map(([val,lbl])=>(
                        <button key={val} onClick={()=>setPaymentStructure(val)} style={{...S.btn(paymentStructure===val?HEADER_BG:WHITE,paymentStructure===val?WHITE:PURPLE_DARK),border:`2px solid ${paymentStructure===val?HEADER_BG:"#d1c9e8"}`,padding:"8px 18px",fontSize:12}}>
                          {lbl}
                        </button>
                      ))}
                    </div>

                    {paymentStructure==="split" && (
                      <div>
                        <label style={S.label}>Split Type</label>
                        <div style={{display:"flex",gap:10}}>
                          {["50/50","33/33/34"].map(s=>(
                            <button key={s} onClick={()=>setSplit(s)} style={{...S.btn(paymentSplit===s?HEADER_BG:WHITE,paymentSplit===s?WHITE:PURPLE_DARK),border:`2px solid ${paymentSplit===s?HEADER_BG:"#d1c9e8"}`,padding:"8px 18px",fontSize:12}}>
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {paymentStructure==="due_now" && (
                      <div style={{background:WHITE,borderRadius:6,padding:"12px 14px",border:`1px solid ${PURPLE_LIGHT}`,fontSize:12,color:"#444"}}>
                        Full amount due at signing or upon completion — no split. Total will display as a single <strong>Total Due</strong> line.
                      </div>
                    )}

                    {paymentStructure==="custom" && (
                      <div>
                        <div style={{fontSize:12,color:"#666",marginBottom:10}}>Define your own payment schedule. Enter a label and amount for each payment.</div>
                        {customPayments.map((cp,i)=>(
                          <div key={cp.id} style={{display:"grid",gridTemplateColumns:"1fr 140px auto",gap:8,marginBottom:8,alignItems:"center"}}>
                            <input style={S.input} placeholder="Label (e.g. Deposit, Balance Due at Completion)" value={cp.label} onChange={e=>updateCustomPayment(cp.id,"label",e.target.value)}/>
                            <div style={{display:"flex",alignItems:"center"}}>
                              <span style={{background:PURPLE_LIGHT,border:"1.5px solid #d1c9e8",borderRight:"none",borderRadius:"6px 0 0 6px",padding:"9px 10px",fontSize:12,fontWeight:700,color:PURPLE_DARK}}>$</span>
                              <input style={{...S.input,borderRadius:"0 6px 6px 0"}} placeholder="0.00" value={cp.amount} onChange={e=>updateCustomPayment(cp.id,"amount",e.target.value)}/>
                            </div>
                            {customPayments.length>1 && (
                              <button onClick={()=>removeCustomPayment(cp.id)} style={{background:"none",border:"none",color:"#c0392b",cursor:"pointer",fontSize:18,fontWeight:700}}>✕</button>
                            )}
                            {customPayments.length===1 && <div/>}
                          </div>
                        ))}
                        <button style={{...S.btn(PURPLE_LIGHT,PURPLE_DARK),border:`1px solid ${PURPLE}33`,fontSize:12,marginTop:4}} onClick={addCustomPayment}>+ Add Payment Line</button>
                      </div>
                    )}

                    {/* Payment preview */}
                    {parsedTotal > 0 && (
                      <div style={{marginTop:14}}>
                        <div style={{fontSize:11,color:"#888",marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>Preview</div>
                        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                          {getPaymentLines(hasAddons?withTotal:parsedTotal, paymentStructure, paymentSplit, customPayments).map((s,i)=>(
                            <div key={i} style={{flex:1,minWidth:120,background:PURPLE_LIGHT,borderRadius:6,padding:"10px 14px",borderLeft:`4px solid ${HEADER_BG}`}}>
                              <div style={{fontSize:11,fontWeight:700,color:PURPLE_DARK}}>{s.label}</div>
                              <div style={{fontSize:15,fontWeight:700,color:NAVY,marginTop:4}}>{fmtAmt(s.amt)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Project Description */}
                  <div style={{marginBottom:20}}>
                    <label style={S.label}>Project Description</label>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:11,color:"#888",fontStyle:"italic"}}>Optional — prints on estimate</span>
                      <button onClick={()=>startListening(t=>setPriceDesc(p=>p?p+" "+t:t))} style={{...S.btn(isListening?"#e74c3c":"#888"),fontSize:10,padding:"3px 10px"}}>{isListening?"🔴 Listening…":"🎤 Voice"}</button>
                    </div>
                    <textarea style={{...S.input,height:90,resize:"vertical"}} placeholder="Brief description of the work to be performed…" value={priceDesc} onChange={e=>setPriceDesc(e.target.value)}/>
                  </div>

                  {/* Optional Add-Ons */}
                  <div>
                    <label style={S.label}>Optional Add-Ons</label>
                    <div style={{fontSize:12,color:"#888",marginBottom:10}}>Check the box to include an add-on in the total. Descriptions are saved to your library for quick reuse.</div>

                    {/* Add-On Library quick-tap (NEW) */}
                    {addonLibrary.length > 0 && (
                      <div style={{marginBottom:12}}>
                        <div style={{fontSize:11,color:"#888",marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>From Library — tap to insert:</div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                          {addonLibrary.map((item,i)=>(
                            <button key={i} onClick={()=>setNewOptText(item)} style={{background:PURPLE_LIGHT,border:`1px solid ${PURPLE}33`,borderRadius:20,padding:"4px 12px",fontSize:11,cursor:"pointer",color:PURPLE_DARK,fontFamily:"Georgia,serif"}}>
                              {item}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {optItems.map(o=>(
                      <div key={o.id} style={{display:"grid",gridTemplateColumns:"auto 1fr 130px auto",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${PURPLE_LIGHT}`}}>
                        <input type="checkbox" checked={!!o.includeInTotal} onChange={e=>updateOpt(o.id,"includeInTotal",e.target.checked)} style={{accentColor:HEADER_BG,width:16,height:16}}/>
                        <input style={{...S.input,fontSize:12.5}} value={o.text} onChange={e=>updateOpt(o.id,"text",e.target.value)}/>
                        <div style={{display:"flex",alignItems:"center"}}>
                          <span style={{background:PURPLE_LIGHT,border:"1.5px solid #d1c9e8",borderRight:"none",borderRadius:"6px 0 0 6px",padding:"9px 10px",fontSize:12,fontWeight:700,color:PURPLE_DARK}}>$</span>
                          <input style={{...S.input,borderRadius:"0 6px 6px 0",width:"100%"}} placeholder="0.00" value={o.price} onChange={e=>updateOpt(o.id,"price",e.target.value)}/>
                        </div>
                        <button onClick={()=>removeOptItem(o.id)} style={{background:"none",border:"none",color:"#ccc",cursor:"pointer",fontSize:16}}>✕</button>
                      </div>
                    ))}
                    <div style={{display:"grid",gridTemplateColumns:"auto 1fr 130px auto",alignItems:"center",gap:10,marginTop:12}}>
                      <div/>
                      <input style={S.input} placeholder="Add optional item description…" value={newOptText} onChange={e=>setNewOptText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addOptItem()}/>
                      <div style={{display:"flex",alignItems:"center"}}>
                        <span style={{background:PURPLE_LIGHT,border:"1.5px solid #d1c9e8",borderRight:"none",borderRadius:"6px 0 0 6px",padding:"9px 10px",fontSize:12,fontWeight:700,color:PURPLE_DARK}}>$</span>
                        <input style={{...S.input,borderRadius:"0 6px 6px 0"}} placeholder="0.00" value={newOptPrice} onChange={e=>setNewOptPrice(e.target.value)}/>
                      </div>
                      <button style={S.btn(HEADER_BG)} onClick={addOptItem}>+ Add</button>
                    </div>
                  </div>

                  {/* Grand Total Summary */}
                  {parsedTotal > 0 && (
                    <div style={{marginTop:20,background:NAVY,borderRadius:8,padding:"14px 20px"}}>
                      <div style={{fontWeight:700,fontSize:11,color:"rgba(255,255,255,0.6)",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Live Price Summary</div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:WHITE,marginBottom:4}}>
                        <span>{job.label}</span><span>{fmtAmt(baseParsedTotal)}</span>
                      </div>
                      {additionalJobs.map((j,i)=>(
                        <div key={j.id||i} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"rgba(255,255,255,0.7)",marginBottom:4}}>
                          <span>+ {j.desc||JOBS[j.type]?.label||j.type}</span><span style={{color:"#7fdd9a"}}>{fmtAmt(j.price)}</span>
                        </div>
                      ))}
                      {addJobsTotal > 0 && (
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:WHITE,marginBottom:4,paddingTop:4,borderTop:"1px solid rgba(255,255,255,0.2)"}}>
                          <span>Jobs Subtotal</span><span>{fmtAmt(parsedTotal)}</span>
                        </div>
                      )}
                      {optItems.filter(o=>o.includeInTotal&&parseFloat(o.price)>0).map(o=>(
                        <div key={o.id} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"rgba(255,255,255,0.7)",marginBottom:4}}>
                          <span>+ {o.text||"Add-on"}</span><span style={{color:"#7fdd9a"}}>{fmtAmt(o.price)}</span>
                        </div>
                      ))}
                      <div style={{borderTop:"1px solid rgba(255,255,255,0.2)",marginTop:8,paddingTop:8,display:"flex",justifyContent:"space-between",fontSize:16,fontWeight:700}}>
                        <span style={{color:WHITE}}>Grand Total</span>
                        <span style={{color:GOLD}}>{fmtAmt(hasAddons ? withTotal : parsedTotal)}</span>
                      </div>
                    </div>
                  )}
                </div>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <button style={S.btn(PURPLE_DARK)} onClick={()=>setStep(3)}>← Back</button>
                  <button style={S.btn(HEADER_BG)} onClick={()=>{setShowPreview(true);setStep(5);}}>Preview & Save →</button>
                </div>
              </>
            )}

            {/* STEP 5 — Save & Preview (MODIFIED) */}
            {showPreview && (
              <>
                <div style={{...S.card,padding:"16px 20px",marginBottom:16}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
                    <div>
                      {contractNumber
                        ? <div><span style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:1}}>Contract Number</span><div style={{fontSize:20,fontWeight:700,color:NAVY,letterSpacing:3}}>{contractNumber}</div></div>
                        : <div style={{fontSize:13,color:"#888"}}>No contract number yet — save to generate.</div>
                      }
                    </div>
                    {/* REMINDER BANNERS */}
                    {(status==="Approved"||status==="Scheduled")&&!(signature&&workAuthGenerated)&&(
                      <div style={{background:"#fff8e8",border:"1px solid #f0d080",borderLeft:"4px solid #C9A84C",borderRadius:8,padding:"10px 14px",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
                        <div>
                          <div style={{fontSize:12,color:"#7a5800",fontWeight:600}}>📋 Work Authorization not yet complete</div>
                          <div style={{fontSize:11,color:"#9a7820",marginTop:2}}>
                            {!signature&&!workAuthGenerated?"Needs homeowner signature and document generation.":!signature?"Needs homeowner signature.":"Needs to be generated — tap Generate Now."}
                          </div>
                        </div>
                        <button style={{...S.btn(GOLD,NAVY),fontSize:11,padding:"5px 14px"}} onClick={()=>{setShowWorkAuth(true);setWorkAuthGenerated(true);}}>Generate Now →</button>
                      </div>
                    )}
                    {isInsuranceJob&&!(signature&&loaGenerated)&&(
                      <div style={{background:"#fff0e8",border:"1px solid #f0a060",borderLeft:"4px solid #e67e22",borderRadius:8,padding:"10px 14px",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
                        <div>
                          <div style={{fontSize:12,color:"#7a3800",fontWeight:600}}>⚡ Letter of Authorization not yet complete</div>
                          <div style={{fontSize:11,color:"#9a5020",marginTop:2}}>
                            {!signature&&!loaGenerated?"Needs homeowner signature and document generation.":!signature?"Needs homeowner signature.":"Needs to be generated and sent to insurer."}
                          </div>
                        </div>
                        <button style={{...S.btn("#e67e22"),fontSize:11,padding:"5px 14px"}} onClick={()=>{setShowLOA(true);setLoaGenerated(true);}}>Generate Now →</button>
                      </div>
                    )}

                    {/* STEP 1 — SIGNATURE */}
                    <div style={{background:signature?"#f0fdf4":"#fff8e8",border:`2px solid ${signature?"#27ae60":"#f0d080"}`,borderRadius:10,padding:"16px 20px",marginBottom:14}}>
                      {signature ? (
                        <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                          <span style={{fontSize:28}}>✅</span>
                          <div style={{flex:1}}>
                            <div style={{fontWeight:700,fontSize:14,color:"#27ae60"}}>Signed by {client.name||"Homeowner"}</div>
                            {signatureTimestamp&&<div style={{fontSize:11,color:"#888",marginTop:2}}>{signatureTimestamp}</div>}
                            {signatureIP&&<div style={{fontSize:10,color:"#aaa"}}>IP: {signatureIP}</div>}
                          </div>
                          <button onClick={()=>setShowSigPad(true)} style={{...S.btn("#888"),fontSize:11}}>✍ Re-Sign</button>
                        </div>
                      ) : (
                        <div>
                          <div style={{fontWeight:700,fontSize:15,color:"#7a5800",marginBottom:4}}>✍ Step 1 — Get {client.name||"the homeowner"} to Sign</div>
                          <div style={{fontSize:12,color:"#7a5800",marginBottom:14,lineHeight:1.6}}>Have the homeowner review this estimate and sign before printing. Their signature confirms they have read and agreed to the scope, pricing, and payment terms.</div>
                          <button className="save-pulse" style={{...S.btn(GOLD,NAVY),fontSize:14,padding:"12px 28px",fontWeight:700}} onClick={()=>setShowSigPad(true)}>✍ Capture Signature</button>
                        </div>
                      )}
                    </div>

                    {/* STEP 2 — DOCUMENT ACTIONS */}
                    <div style={{background:WHITE,border:`1px solid ${PURPLE_LIGHT}`,borderRadius:10,padding:"14px 18px"}}>
                      <div style={{fontWeight:700,fontSize:10,color:"#888",textTransform:"uppercase",letterSpacing:1.5,marginBottom:12}}>Step 2 — Document Actions</div>
                      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
                        {!isSaved
                          ? <button className={hasUnsavedData?"save-pulse":""} style={{...S.btn(isEditing?"#e8a020":HEADER_BG,isEditing?NAVY:"#fff"),transition:"all 0.3s"}} onClick={()=>{if(validate())handleSaveEstimate();}} disabled={saveStatus==="saving"}>
                              {saveStatus==="saving"?"⏳ Saving…":isEditing?"💾 Save Revised":"💾 Save Estimate"}
                            </button>
                          : <div style={{...S.tag("#27ae60"),fontSize:12,padding:"6px 12px"}}>{saveStatus==="saved-local"?"✓ Saved Locally":"✓ Saved"}</div>
                        }
                        <button style={S.btn(NAVY)} onClick={()=>window.print()}>🖨 Print</button>
                        <button style={S.btn(isPdfLoading?"#888":PURPLE_DARK)} onClick={handleDownloadPDF} disabled={isPdfLoading}>{isPdfLoading?"⏳…":"⬇ PDF"}</button>
                        <button style={S.btn("#2980b9")} onClick={()=>{setClientEmail(client.email||clientEmail||"");setShowEmailModal(true);}}>✉ Email</button>
                        <button style={S.btn(PURPLE_DARK)} onClick={()=>{setShowPreview(false);setStep(4);}}>← Edit</button>
                      </div>
                      <div style={{display:"flex",gap:8,flexWrap:"wrap",borderTop:`1px solid ${PURPLE_LIGHT}`,paddingTop:10}}>
                        <button style={S.btn("#2c3e50")} onClick={()=>{setShowWorkAuth(true);setWorkAuthGenerated(true);}}>📋 Work Authorization</button>
                        {isInsuranceJob&&<button style={S.btn("#e67e22")} onClick={()=>{setShowLOA(true);setLoaGenerated(true);}}>📄 Letter of Authorization</button>}
                      </div>
                    </div>
                  </div>

                  {/* Contract Link display (NEW) */}
                  {isSaved && contractLink && (
                    <div style={{marginTop:14,padding:"12px 14px",background:PURPLE_LIGHT,borderRadius:8,border:`1px solid ${PURPLE}33`}}>
                      <div style={{fontSize:11,fontWeight:700,color:PURPLE_DARK,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>📋 Shareable Contract Link</div>
                      <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                        <a href={contractLink} target="_blank" rel="noreferrer" style={{fontSize:12,color:HEADER_BG,fontWeight:600,wordBreak:"break-all"}}>{contractLink}</a>
                        <button
                          style={{...S.btn(HEADER_BG),fontSize:11,padding:"6px 14px",flexShrink:0}}
                          onClick={()=>{navigator.clipboard.writeText(contractLink).then(()=>alert("Link copied to clipboard!")).catch(()=>prompt("Copy this link:",contractLink));}}
                        >
                          📋 Copy Link
                        </button>
                      </div>
                      <div style={{fontSize:11,color:"#888",marginTop:6}}>Paste this link to auto-load the estimate. Works in Google Sheets as a HYPERLINK formula.</div>
                    </div>
                  )}
                </div>
                <div style={{...S.card,padding:0,overflow:"hidden"}}>
                  <div style={{background:PURPLE_LIGHT,padding:"8px 20px",fontSize:12,color:PURPLE_DARK,fontWeight:700,borderBottom:`1px solid #d1c9e8`}}>
                    ↓ Your document preview is below — scroll down to see it
                  </div>
                  <ProposalPreview {...previewProps}/>
                </div>
              </>
            )}
          </>
        )}

        {/* ══ INVOICE MODE ══ */}
        {mode==="invoice" && (
          <>
            {!bInvPreview ? (
              <>
                <div style={S.card}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
                    <div><div style={{fontWeight:700,fontSize:18,color:PURPLE_DARK}}>🧾 Billing Invoice</div><div style={{fontSize:12,color:"#888",marginTop:2}}>For collections and receipts</div></div>
                    <button style={S.btn("#888")} onClick={resetBillingInv}>+ New Blank Invoice</button>
                  </div>
                  <div style={{padding:16,background:"#f8f7fb",borderRadius:8,border:`1px solid #d1c9e8`,marginBottom:20}}>
                    <div style={{fontWeight:700,fontSize:12,color:PURPLE_DARK,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Load from Saved Estimate (optional)</div>
                    <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                      <select style={{...S.input,flex:1}} value={bInvContract} onChange={e=>{setBInvContract(e.target.value);if(e.target.value)loadBillingFromContract(e.target.value);}}>
                        <option value="">— Select a contract to auto-fill —</option>
                        {dashboardData.slice().reverse().map(e=>(<option key={e.contractNumber} value={e.contractNumber}>{e.contractNumber} · {e.client?.name||"No name"}</option>))}
                      </select>
                      {bInvContract&&<button style={S.btn("#888")} onClick={()=>{setBInvContract("");setBInvClient({name:"",address:"",city:""});setBInvLines([{id:1,desc:"",amt:""}]);}}>Clear</button>}
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:14,marginBottom:16}}>
                    <div><label style={S.label}>Invoice Number</label><div style={{display:"flex",gap:8}}><input style={{...S.input,flex:1}} value={bInvNum} onChange={e=>setBInvNum(e.target.value)} placeholder="Auto-generate"/><button style={{...S.btn(HEADER_BG),padding:"8px 10px",fontSize:11}} onClick={()=>setBInvNum(genBillingNum())}>Gen</button></div></div>
                    <div><label style={S.label}>Invoice Date</label><input style={S.input} value={bInvDate} onChange={e=>setBInvDate(e.target.value)}/></div>
                    <div><label style={S.label}>Due Date</label><input style={S.input} placeholder="e.g. Due upon receipt" value={bInvDueDate} onChange={e=>setBInvDueDate(e.target.value)}/></div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:14,marginBottom:16}}>
                    <div><label style={S.label}>Client Name</label><input style={S.input} value={bInvClient.name} onChange={e=>setBInvClient(p=>({...p,name:e.target.value}))}/></div>
                    <div><label style={S.label}>Property Address</label><input style={S.input} value={bInvClient.address} onChange={e=>setBInvClient(p=>({...p,address:e.target.value}))}/></div>
                    <div><label style={S.label}>City, State, ZIP</label><input style={S.input} value={bInvClient.city} onChange={e=>setBInvClient(p=>({...p,city:e.target.value}))}/></div>
                  </div>
                </div>
                <div style={S.card}>
                  <div style={{fontWeight:700,fontSize:14,color:PURPLE_DARK,marginBottom:14}}>Description of Services</div>
                  <div style={{marginBottom:8,display:"grid",gridTemplateColumns:"1fr 160px 40px",gap:8}}>
                    <div style={{fontSize:11,color:"#888",fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Description</div>
                    <div style={{fontSize:11,color:"#888",fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Amount</div>
                    <div/>
                  </div>
                  {bInvLines.map((l)=>(
                    <div key={l.id} style={{display:"grid",gridTemplateColumns:"1fr 160px 40px",gap:8,marginBottom:8,alignItems:"center"}}>
                      <input style={S.input} placeholder="e.g. Tear-Off and Replacement" value={l.desc} onChange={e=>updateBInvLine(l.id,"desc",e.target.value)}/>
                      <div style={{display:"flex",alignItems:"center"}}>
                        <span style={{background:PURPLE_LIGHT,border:"1.5px solid #d1c9e8",borderRight:"none",borderRadius:"6px 0 0 6px",padding:"9px 10px",fontSize:12,fontWeight:700,color:PURPLE_DARK}}>$</span>
                        <input style={{...S.input,borderRadius:"0 6px 6px 0"}} placeholder="0.00" value={l.amt} onChange={e=>updateBInvLine(l.id,"amt",e.target.value)}/>
                      </div>
                      <button onClick={()=>removeBInvLine(l.id)} style={{background:"none",border:"none",color:bInvLines.length>1?"#c0392b":"#ddd",cursor:bInvLines.length>1?"pointer":"default",fontSize:18,fontWeight:700}}>✕</button>
                    </div>
                  ))}
                  <button style={{...S.btn(PURPLE_LIGHT,PURPLE_DARK),border:`1px solid ${PURPLE}33`,fontSize:12,marginTop:4}} onClick={addBInvLine}>+ Add Line Item</button>
                  {bInvLines.some(l=>l.amt)&&(<div style={{display:"flex",justifyContent:"flex-end",marginTop:16}}><div style={{background:NAVY,color:WHITE,padding:"10px 20px",borderRadius:8,fontSize:14,fontWeight:700}}>Total Due: {(()=>{const t=bInvLines.reduce((s,l)=>s+(parseFloat(String(l.amt).replace(/[^0-9.]/g,""))||0),0);return "$"+t.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});})()}</div></div>)}
                </div>
                <div style={S.card}>
                  <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14,marginBottom:16}}>
                    <div><label style={S.label}>Payment Terms</label><input style={S.input} value={bInvTerms} onChange={e=>setBInvTerms(e.target.value)}/></div>
                    <div><label style={S.label}>Accepted Payment Methods</label><input style={S.input} value={bInvMethods} onChange={e=>setBInvMethods(e.target.value)}/></div>
                  </div>
                  <div><label style={S.label}>Invoice Status</label><div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:6}}>{STATUS_OPTIONS.map(s=>(<button key={s} onClick={()=>setBInvStatus(s)} style={{...S.btn(bInvStatus===s?STATUS_COLORS[s]||HEADER_BG:WHITE,bInvStatus===s?WHITE:PURPLE_DARK),border:`2px solid ${bInvStatus===s?STATUS_COLORS[s]||HEADER_BG:"#d1c9e8"}`,padding:"6px 14px",fontSize:12}}>{s}</button>))}</div></div>
                </div>
                <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
                  <button style={S.btn(HEADER_BG)} onClick={()=>{if(!bInvNum)setBInvNum(genBillingNum());setBInvPreview(true);}}>Preview Invoice →</button>
                </div>
              </>
            ) : (
              <>
                {/* Billing Invoice Preview */}
                <div style={{...S.card,padding:0,overflow:"hidden"}}>
                  <div style={{background:PURPLE_LIGHT,padding:"10px 20px",fontSize:12,color:PURPLE_DARK,fontWeight:700,borderBottom:`1px solid #d1c9e8`}}>
                    ↓ Invoice Preview — scroll down to view
                  </div>
                  <BillingInvoicePreview roofingLogo={ROOFING_LOGO} preparedBy={preparedBy} pm={pm} bInvNum={bInvNum} bInvDate={bInvDate} bInvDueDate={bInvDueDate} bInvClient={bInvClient} bInvLines={bInvLines} bInvTerms={bInvTerms} bInvMethods={bInvMethods} bInvStatus={bInvStatus}/>
                </div>
                <div style={{display:"flex",gap:10,justifyContent:"space-between",flexWrap:"wrap"}}>
                  <button style={S.btn(PURPLE_DARK)} onClick={()=>setBInvPreview(false)}>← Edit Invoice</button>
                  <button style={S.btn(bInvSaved?"#27ae60":bInvSaving?"#888":HEADER_BG)} onClick={handleSaveBillingInvoice} disabled={bInvSaving}>
                    {bInvSaved?"✓ Saved!":bInvSaving?"⏳ Saving…":"💾 Save Invoice"}
                  </button>
                  <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                    <button style={S.btn(PURPLE_DARK)} onClick={()=>{setDocType("invoice");window.print();}}>🖨 Print</button>
                    <button style={S.btn(isPdfLoading?"#888":PURPLE_DARK)} onClick={handleDownloadPDF} disabled={isPdfLoading}>{isPdfLoading?"⏳ Generating…":"⬇ Download PDF"}</button>
                    <button style={S.btn("#2980b9")} onClick={()=>{setClientEmail(bInvClient.email||clientEmail||"");setShowEmailModal(true);}}>✉ Email to Client</button>
                  </div>
                </div>
                <div style={{...S.card,display:"none"}} id="OLD_INV_PLACEHOLDER">
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:14,color:PURPLE_DARK}}>Invoice #{invNum}</div>
                      {linkedContract && <div style={{fontSize:12,color:"#888",marginTop:2}}>RE: Estimate {linkedContract}</div>}
                    </div>
                    <span style={S.tag(GOLD)}>INVOICE</span>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:14,marginBottom:14}}>
                    <div><label style={S.label}>Invoice #</label><input style={S.input} value={invNum} onChange={e=>setInvNum(e.target.value)}/></div>
                    <div><label style={S.label}>Invoice Date</label><input style={S.input} value={docDate} onChange={e=>setDocDate(e.target.value)}/></div>
                    <div><label style={S.label}>Due Date</label><input style={S.input} value={invDue} onChange={e=>setInvDue(e.target.value)}/></div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                    {[["name","Client Name"],["address","Property Address"],["phone","Phone"],["email","Email"]].map(([k,lbl])=>(
                      <div key={k}><label style={S.label}>{lbl}</label><input style={S.input} value={client[k]||""} onChange={e=>setClient(p=>({...p,[k]:k==="phone"?formatPhone(e.target.value):e.target.value}))}/></div>
                    ))}
                  </div>
                </div>

                <div style={S.card}>
                  <div style={{fontWeight:700,fontSize:14,color:PURPLE_DARK,marginBottom:14}}>Job Type</div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
                    {Object.entries(JOBS).map(([key,j])=>(
                      <button key={key} onClick={()=>setJobType(key)} style={{background:jobType===key?j.color:WHITE,color:jobType===key?WHITE:TEXT,border:`2px solid ${jobType===key?j.color:"#d1c9e8"}`,borderRadius:6,padding:"6px 14px",cursor:"pointer",fontFamily:"Georgia,serif",fontSize:12}}>
                        {j.icon} {j.label}
                      </button>
                    ))}
                  </div>
                  <div style={{fontWeight:700,fontSize:14,color:PURPLE_DARK,marginBottom:14}}>Pricing</div>
                  <div style={{marginBottom:16}}>
                    <label style={S.label}>Total Price</label>
                    <div style={{display:"flex",alignItems:"center"}}>
                      <span style={{background:PURPLE_LIGHT,border:"1.5px solid #d1c9e8",borderRight:"none",borderRadius:"6px 0 0 6px",padding:"9px 14px",fontSize:15,fontWeight:700,color:PURPLE_DARK}}>$</span>
                      <input style={{...S.input,borderRadius:"0 6px 6px 0",fontSize:15,fontWeight:700}} placeholder="0.00" value={totalPrice} onChange={e=>setTotalPrice(e.target.value)}/>
                    </div>
                  </div>
                  <div style={{marginBottom:16}}>
                    <label style={S.label}>Description</label>
                    <textarea style={{...S.input,height:70,resize:"vertical"}} placeholder="Description of work performed…" value={priceDesc} onChange={e=>setPriceDesc(e.target.value)}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}>
                    <table style={{fontSize:13,borderCollapse:"collapse",minWidth:220}}>
                      <tbody>
                        <tr style={{background:PURPLE_LIGHT}}><td style={{padding:"7px 14px",fontWeight:700,color:PURPLE_DARK}}>Sub Total</td><td style={{padding:"7px 14px",textAlign:"right",fontWeight:700}}>{fmtAmt(parsedTotal)}</td></tr>
                        {invPaid && <tr><td style={{padding:"7px 14px",color:"#888"}}>Amount Paid</td><td style={{padding:"7px 14px",textAlign:"right",color:"#27ae60",fontWeight:700}}>- {fmtAmt(invPaid)}</td></tr>}
                        <tr style={{background:HEADER_BG}}><td style={{padding:"8px 14px",fontWeight:700,color:WHITE,fontSize:14}}>Balance Due</td><td style={{padding:"8px 14px",textAlign:"right",fontWeight:700,color:GOLD,fontSize:14}}>{fmtAmt(parsedTotal-(parseFloat(String(invPaid).replace(/[^0-9.]/g,""))||0))}</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                    <div><label style={S.label}>Amount Previously Paid</label><input style={S.input} placeholder="0.00" value={invPaid} onChange={e=>setInvPaid(e.target.value)}/></div>
                  </div>

                  {/* Payment Structure on Invoice */}
                  <div style={{marginTop:16,padding:14,background:"#f8f7fb",borderRadius:8,border:`1px solid #d1c9e8`}}>
                    <div style={{fontWeight:700,fontSize:12,color:PURPLE_DARK,textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>Payment Structure</div>
                    <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:12}}>
                      {[["split","Split Payment"],["due_now","Due Now (Full)"],["custom","Custom Terms"]].map(([val,lbl])=>(
                        <button key={val} onClick={()=>setPaymentStructure(val)} style={{...S.btn(paymentStructure===val?HEADER_BG:WHITE,paymentStructure===val?WHITE:PURPLE_DARK),border:`2px solid ${paymentStructure===val?HEADER_BG:"#d1c9e8"}`,padding:"8px 18px",fontSize:12}}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                    {paymentStructure==="split" && (
                      <div style={{display:"flex",gap:10}}>
                        {["50/50","33/33/34"].map(s=>(
                          <button key={s} onClick={()=>setSplit(s)} style={{...S.btn(paymentSplit===s?HEADER_BG:WHITE,paymentSplit===s?WHITE:PURPLE_DARK),border:`2px solid ${paymentSplit===s?HEADER_BG:"#d1c9e8"}`,padding:"6px 16px",fontSize:12}}>
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                    {paymentStructure==="custom" && (
                      <div>
                        {customPayments.map((cp)=>(
                          <div key={cp.id} style={{display:"grid",gridTemplateColumns:"1fr 140px auto",gap:8,marginBottom:8,alignItems:"center"}}>
                            <input style={S.input} placeholder="Label (e.g. Balance Due at Completion)" value={cp.label} onChange={e=>updateCustomPayment(cp.id,"label",e.target.value)}/>
                            <div style={{display:"flex",alignItems:"center"}}>
                              <span style={{background:PURPLE_LIGHT,border:"1.5px solid #d1c9e8",borderRight:"none",borderRadius:"6px 0 0 6px",padding:"9px 10px",fontSize:12,fontWeight:700,color:PURPLE_DARK}}>$</span>
                              <input style={{...S.input,borderRadius:"0 6px 6px 0"}} placeholder="0.00" value={cp.amount} onChange={e=>updateCustomPayment(cp.id,"amount",e.target.value)}/>
                            </div>
                            {customPayments.length>1 && <button onClick={()=>removeCustomPayment(cp.id)} style={{background:"none",border:"none",color:"#c0392b",cursor:"pointer",fontSize:18,fontWeight:700}}>✕</button>}
                            {customPayments.length===1 && <div/>}
                          </div>
                        ))}
                        <button style={{...S.btn(PURPLE_LIGHT,PURPLE_DARK),border:`1px solid ${PURPLE}33`,fontSize:12}} onClick={addCustomPayment}>+ Add Payment Line</button>
                      </div>
                    )}
                    {parsedTotal > 0 && (
                      <div style={{marginTop:12,display:"flex",gap:10,flexWrap:"wrap"}}>
                        {getPaymentLines(parsedTotal-(parseFloat(String(invPaid).replace(/[^0-9.]/g,""))||0), paymentStructure, paymentSplit, customPayments).map((s,i)=>(
                          <div key={i} style={{flex:1,minWidth:120,background:PURPLE_LIGHT,borderRadius:6,padding:"8px 12px",borderLeft:`4px solid ${HEADER_BG}`}}>
                            <div style={{fontSize:11,fontWeight:700,color:PURPLE_DARK}}>{s.label}</div>
                            <div style={{fontSize:14,fontWeight:700,color:NAVY,marginTop:3}}>{fmtAmt(s.amt)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
                  <button style={S.btn(PURPLE_DARK)} onClick={()=>{setInvStarted(false);setLinkedContract("");}}>← Back</button>
                  <button style={S.btn(GOLD,NAVY)} onClick={()=>{setDocType("invoice");setShowPreview(true);setMode("proposal");setStep(5);}}>Preview & Print 🖨</button>
                </div>
              </>
            )}
          </>
        )}

        {/* Save pulse animation */}
        <style>{`@keyframes savePulse{0%,100%{box-shadow:0 0 0 0 rgba(39,174,96,0.5)}50%{box-shadow:0 0 0 12px rgba(39,174,96,0)}}@keyframes floatPulse{0%,100%{box-shadow:0 6px 24px rgba(39,174,96,0.5)}50%{box-shadow:0 6px 32px rgba(39,174,96,0.8)}}.save-pulse{animation:savePulse 1.4s ease-in-out infinite}.float-pulse{animation:floatPulse 1.4s ease-in-out infinite}`}</style>

        {/* Toast Notifications */}
        <div style={{position:"fixed",bottom:24,right:24,zIndex:9999,display:"flex",flexDirection:"column",gap:8,maxWidth:360,pointerEvents:"none"}}>
          {toasts.map(t=>(
            <div key={t.id} style={{background:t.type==="success"?"#27ae60":t.type==="error"?"#c0392b":t.type==="warning"?"#e67e22":HEADER_BG,color:"#fff",padding:"12px 16px",borderRadius:10,fontSize:13,fontWeight:600,boxShadow:"0 4px 16px rgba(0,0,0,0.2)",display:"flex",alignItems:"center",gap:10,pointerEvents:"all"}}>
              <span style={{flexShrink:0}}>{t.type==="success"?"✓":t.type==="error"?"✕":t.type==="warning"?"⚠":"ℹ"}</span>
              <span style={{flex:1}}>{t.msg}</span>
              <button onClick={()=>setToasts(p=>p.filter(x=>x.id!==t.id))} style={{background:"none",border:"none",color:"rgba(255,255,255,0.7)",cursor:"pointer",fontSize:16,flexShrink:0,pointerEvents:"all"}}>✕</button>
            </div>
          ))}
        </div>

        {/* Floating sticky save button */}
        {appMode==="form" && mode==="proposal" && !showPreview && hasUnsavedData && (
          <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",zIndex:998,pointerEvents:"all"}}>
            <button
              className="float-pulse"
              onClick={()=>{if(proposalMode==="quick")handleQuickSaveAndPreview();else if(validate())handleSaveEstimate();}}
              disabled={saveStatus==="saving"}
              style={{background:saveStatus==="saving"?"#888":"#27ae60",color:"#fff",border:"none",borderRadius:30,padding:"14px 32px",fontSize:15,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:10,fontFamily:"Georgia,serif",letterSpacing:0.5}}>
              <span style={{fontSize:18}}>💾</span>
              {saveStatus==="saving"?"Saving…":"Save Estimate"}
              <span style={{fontSize:11,opacity:0.8,marginLeft:4}}>tap to save</span>
            </button>
          </div>
        )}

        {/* LOA MODAL */}
        {showLOA&&(
          <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",zIndex:1000,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:16,overflowY:"auto"}}>
            <div style={{background:"#fff",borderRadius:12,maxWidth:860,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.3)",marginTop:20,marginBottom:20}}>
              <div style={{background:NAVY,borderRadius:"12px 12px 0 0",padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontWeight:700,fontSize:16,color:GOLD}}>📄 Letter of Authorization</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginTop:2}}>Third-Party Authorization to Communicate with Insurance Provider</div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>window.print()} style={{...S.btn(GOLD,NAVY),fontSize:12}}>🖨 Print</button>
                  <button onClick={()=>setShowLOA(false)} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",fontSize:20,cursor:"pointer",borderRadius:6,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                </div>
              </div>
              <div style={{padding:20}}>
                <LOAPreview
                  roofingLogo={ROOFING_LOGO} churchLogo={CHURCH_LOGO} client={client} insFields={insFields}
                  contractNumber={contractNumber} docDate={docDate}
                  signature={signature} signatureTimestamp={signatureTimestamp} signatureIP={signatureIP}
                />
              </div>
            </div>
          </div>
        )}

        {/* WORK AUTH MODAL */}
        {showWorkAuth&&(
          <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",zIndex:1000,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:16,overflowY:"auto"}}>
            <div style={{background:"#fff",borderRadius:12,maxWidth:860,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.3)",marginTop:20,marginBottom:20}}>
              <div style={{background:NAVY,borderRadius:"12px 12px 0 0",padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontWeight:700,fontSize:16,color:GOLD}}>📋 Work Authorization</div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>{setShowWorkAuth(false);setTimeout(()=>{const wa=document.getElementById("work-auth-area");if(wa)window.print();},100);}} style={{...S.btn(GOLD,NAVY),fontSize:12}}>🖨 Print</button>
                  <button onClick={()=>setShowWorkAuth(false)} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",fontSize:20,cursor:"pointer",borderRadius:6,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                </div>
              </div>
              <div style={{padding:20}}>
                <WorkAuthPreview
                  roofingLogo={ROOFING_LOGO} churchLogo={CHURCH_LOGO}
                  client={client} job={JOBS[jobType]} contractNumber={contractNumber}
                  docDate={docDate} preparedBy={preparedBy} totalPrice={totalPrice}
                  paymentSplit={paymentSplit} signature={signature}
                  signatureTimestamp={signatureTimestamp} signatureIP={signatureIP}
                  scopeItems={scopeItems}
                />
              </div>
            </div>
          </div>
        )}

        {/* HELP MODAL */}
        {showHelp && (
          <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",zIndex:1000,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:16,overflowY:"auto"}}>
            <div style={{background:"#fff",borderRadius:12,maxWidth:640,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.3)",marginTop:20,marginBottom:20}}>
              <div style={{background:NAVY,borderRadius:"12px 12px 0 0",padding:"16px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontWeight:700,fontSize:17,color:GOLD}}>Help & FAQ</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginTop:2}}>Beshert Roofing Estimate Tool</div>
                </div>
                <button onClick={()=>setShowHelp(false)} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",fontSize:20,cursor:"pointer",borderRadius:6,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
              </div>
              <div style={{padding:20}}>
                {HELP_TOPICS.map((topic,i)=>(
                  <HelpTopic key={topic.id} topic={topic} isLast={i===HELP_TOPICS.length-1}/>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SIGNATURE PAD MODAL */}
        {showSigPad&&(<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.55)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}><div style={{background:"#fff",borderRadius:12,padding:24,maxWidth:500,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}><div style={{fontWeight:700,fontSize:16,color:PURPLE_DARK,marginBottom:8}}>✍ Client Signature</div>
<div style={{background:"#fff8e8",border:"1px solid #f0d080",borderRadius:6,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#7a5800",lineHeight:1.6}}>
  By signing below, the homeowner confirms they have read and agreed to the full scope of work, pricing, and payment terms of this estimate. This signature authorizes Beshert Roofing Redevelopment Group to perform the work described.
</div>
<div style={{fontSize:11,color:"#888",marginBottom:10}}>Sign below using finger or mouse. Timestamp and IP address will be recorded.</div><canvas ref={sigCanvasRef} width={440} height={150} style={{border:`2px solid ${PURPLE_LIGHT}`,borderRadius:8,cursor:"crosshair",background:"#fafafa",display:"block",width:"100%",touchAction:"none"}} onMouseDown={sigStart} onMouseMove={sigMove} onMouseUp={sigEnd} onMouseLeave={sigEnd} onTouchStart={sigStart} onTouchMove={sigMove} onTouchEnd={sigEnd}/><div style={{display:"flex",gap:10,marginTop:14,justifyContent:"flex-end"}}><button style={S.btn("#888")} onClick={sigClear}>Clear</button><button style={S.btn("#888")} onClick={()=>setShowSigPad(false)}>Cancel</button><button style={S.btn(HEADER_BG)} onClick={sigCapture}>Save Signature</button></div></div></div>)}

        {/* EMAIL MODAL */}
        {showEmailModal&&(<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.55)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}><div style={{background:"#fff",borderRadius:12,padding:24,maxWidth:480,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}><div style={{fontWeight:700,fontSize:16,color:PURPLE_DARK,marginBottom:4}}>✉ Email {docType==="invoice"?"Invoice":"Estimate"} to Client</div>
              <div style={{marginBottom:14}}>
                <label style={S.label}>Send From</label>
                <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:6}}>
                  {["beshert@thebeshertgroup.com","cbrown7745@gmail.com"].map(em=>(
                    <button key={em} onClick={()=>setSendFromEmail(em)} style={{...S.btn(sendFromEmail===em?HEADER_BG:WHITE,sendFromEmail===em?WHITE:PURPLE_DARK),border:`2px solid ${sendFromEmail===em?HEADER_BG:"#d1c9e8"}`,padding:"6px 14px",fontSize:11}}>{em}</button>
                  ))}
                </div>
              </div>
              <div style={{marginBottom:14}}><label style={S.label}>Client Email Address</label><input style={S.input} type="email" placeholder="homeowner@email.com" value={clientEmail} onChange={e=>setClientEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleMailto()}/></div><div style={{marginBottom:16,padding:"10px 14px",background:PURPLE_LIGHT,borderRadius:6,fontSize:12,color:PURPLE_DARK}}><strong>Subject:</strong> Your {docType==="invoice"?"Invoice":"Estimate"} from Beshert Roofing — {contractNumber||"(save first to generate #)"}</div><div style={{fontSize:12,color:"#888",marginBottom:12,padding:"8px 12px",background:"#f8f9fb",borderRadius:6}}>📱 This will open your email app with everything pre-filled. Just tap Send.</div><div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><button style={S.btn("#888")} onClick={()=>setShowEmailModal(false)}>Cancel</button><button style={S.btn("#2980b9")} onClick={handleMailto}>Open Email App →</button></div></div></div>)}

      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// HELP MODAL CONTENT
// ══════════════════════════════════════════════════════
const HELP_TOPICS = [
  {
    id:"quick-vs-full",
    title:"Quick Estimate vs. Full Estimate",
    icon:"🚀",
    content:`<b>Quick Estimate</b> is for when you're at someone's door and need to give them a number fast. Fill in the name, address, job type, and price — that's it. The legal pages and scope of work get added automatically. You're done in under a minute.
<b>Full Estimate</b> is for when you need to customize. You can edit the scope line by line, choose which legal pages to include, set up a custom payment schedule, and add materials. Use Full Estimate when the job is complicated or the homeowner wants to see details.
<b>Tip:</b> Start with Quick Estimate. If the homeowner wants more detail, switch to Full Estimate — everything you already filled in carries over.`
  },
  {
    id:"amend",
    title:"How to Change a Saved Estimate",
    icon:"✏️",
    content:`Go to the <b>Dashboard</b>. Find the estimate you want to change. Click anywhere on that row to open it.
The estimate opens in Full Estimate mode so you can access all the steps. Make your changes — update the price, edit the scope, change the client info, whatever you need.
When you're done, click <b>Save</b>. The estimate saves under the same contract number and gets marked as <b>Revised</b> so you know it changed.
<b>Tip:</b> You can also update the job status right from the dashboard without opening the estimate. Just click the colored status button on the row and pick the new status.`
  },
  {
    id:"sync",
    title:"What ☁ and 📱 Mean",
    icon:"☁",
    content:`Every estimate row on the dashboard shows a small icon next to the contract number.
<b>☁ (cloud)</b> means the estimate is saved to Google Sheets and is safe even if you lose your phone or switch devices. This is what you want.
<b>📱 (phone)</b> means the estimate is only saved on this device right now. It's not backed up to the cloud yet. This usually happens when you don't have internet when you save.
If you see 📱 estimates, tap the <b>Sync</b> button at the top of the dashboard to push them to the cloud. Do this any time you get back on a good Wi-Fi connection.`
  },
  {
    id:"duplicate",
    title:"How to Duplicate an Estimate",
    icon:"⧉",
    content:`Duplicating makes a copy of an estimate so you can reuse it for a different job without starting from scratch. It's useful when you're doing the same type of work for multiple homes in the same neighborhood.
On the <b>Dashboard</b>, find the estimate you want to copy. Click the <b>⧉ Duplicate</b> button on that row. The estimate opens as a new one — same scope, same job type, same price — but with a blank contract number.
Update the client name and address, then click <b>Save</b>. A new contract number gets created automatically.
<b>Important:</b> Duplicating does not change the original. The original stays exactly as it was.`
  },
  {
    id:"insurance",
    title:"Insurance Claim Jobs",
    icon:"⚡",
    content:`When a job is being paid by a homeowner's insurance, turn on the <b>Insurance Job</b> toggle in Step 1 of the Full Estimate.
This adds a section where you can enter the insurance company name, claim number, adjuster name, ACV (what the insurer approved), RCV (the full replacement cost), deductible, and more.
Once you fill those in, the estimate automatically calculates:
• <b>Expected insurance check</b> — ACV minus the deductible
• <b>Supplement target</b> — the gap between RCV and ACV that you may need to recover
• <b>Client out-of-pocket</b> — what the homeowner owes directly
All of this prints on the estimate so the homeowner can see exactly how the numbers work.`
  },
  {
    id:"signature",
    title:"Capturing a Signature",
    icon:"✍️",
    content:`After you save an estimate, the preview screen shows <b>Step 1 — Get the homeowner's signature</b>. This is the first thing to do before printing.

Tap <b>✍ Capture Signature</b>. A box opens with a brief statement explaining what the homeowner is agreeing to. Hand them the phone and have them sign with their finger. Tap <b>Save Signature</b>.

The tool automatically records the <b>date, time, and IP address</b> when the signature is saved. This prints on the estimate beneath the signature line and makes the document legally defensible under Ohio contract law.

Once signed, the Step 1 card turns green with a ✅ confirmation. Then use <b>Step 2 — Document Actions</b> to print, download, or email.

If you need a fresh signature, tap <b>Re-Sign</b> at any time.`
  },
  {
    id:"email",
    title:"Emailing an Estimate to the Homeowner",
    icon:"✉️",
    content:`On the preview screen, tap <b>✉ Email to Client</b>. A small box opens. Type the homeowner's email address, then tap <b>Open Email App</b>.
Your email app opens with everything already filled in — the subject line, the estimate details, the contract number, and the payment schedule. All you have to do is tap <b>Send</b>.
<b>Note:</b> Right now the email opens your email app and you send it manually. A future update will send it automatically without that extra step.`
  },
  {
    id:"invoice",
    title:"Billing Invoice vs. Estimate",
    icon:"🧾",
    content:`These are two different documents used at different times.
<b>Estimate</b> — Given to the homeowner <i>before</i> the job starts. It shows what you're going to do and what it will cost. It has the full scope of work, legal pages, warranty, and signature line.
<b>Billing Invoice</b> — Sent to the homeowner <i>after</i> the job is done (or for a deposit). It shows what was done and what they owe. It's a clean, simple document — just the description of services and the total.
To create a billing invoice, tap the <b>Invoice</b> tab at the top. You can load a saved estimate to auto-fill the client info and line items, or start from scratch.`
  },
  {
    id:"voiceinput",
    title:"Talk to Text — Voice Input",
    icon:"🎤",
    content:`You can speak instead of type in three places in the tool — the Notes field in Quick Estimate, the Notes field in Full Estimate, and the Price Description field in Step 4.

Tap the <b>🎤 Voice</b> button next to the field. It turns red and shows <b>🔴 Listening…</b> Speak clearly. When you stop, your words appear in the field automatically. If there is already text in the field, the new words are added to the end.

<b>Works best:</b> iPhone with Safari, Android with Chrome. Sit in the truck or inside the house — outdoor construction noise can affect accuracy.

<b>If it does not work:</b> Your browser may not support voice input. The tool will show a message. Type normally in that case.

<b>Tip:</b> Use it for the Notes field. Say "gate code 1234" or "owner prefers calls after 3pm" without typing on a small screen.`
  },
  {
    id:"workauth",
    title:"Work Authorization",
    icon:"📋",
    content:`The Work Authorization is a separate document from the estimate. The estimate describes what you'll do and what it costs. The Work Authorization is the homeowner's official permission for Beshert to begin the physical work.

After saving an estimate, go to the preview screen. In the <b>Step 2 — Document Actions</b> section, tap <b>📋 Work Authorization</b>. A full branded document opens with the property info, job description, and a 4-point authorization agreement already filled in.

Have the homeowner sign it — the signature from Step 1 is automatically included. Then tap <b>Print</b> to print it separately.

<b>When to use it:</b> Get the estimate signed first (Step 1). Then generate the Work Authorization on or before the day work begins. Keep a signed copy for your records.`
  },
  {
    id:"loa",
    title:"Letter of Authorization (Insurance Jobs)",
    icon:"📄",
    content:`For insurance jobs, you need a Letter of Authorization (LOA) to communicate with the homeowner's insurance company on their behalf. Without it, the insurance company cannot legally speak to you about the claim.

The LOA is only available when the <b>Insurance Job</b> toggle is turned on. After saving the estimate, go to the preview screen. In Step 2, tap <b>📄 Letter of Authorization</b>. The document opens pre-filled with the insurance company name, claim number, policy number, adjuster name, and property address — all pulled from what you entered in Step 1.

Have the homeowner sign it. Then fax or email it directly to the insurance company's claims department. The document includes a section at the top for the fax number, adjuster name, and date sent.

<b>Important:</b> This document authorizes Beshert to communicate about the claim. It does not give Beshert the right to accept payment or settle the claim on the homeowner's behalf.`
  },
  {
    id:"status",
    title:"Job Status Labels",
    icon:"🏷",
    content:`Status labels help you track where every job stands. You can update a job's status from the dashboard without opening the estimate — just tap the colored status button on the row.
<b>Pending</b> — Estimate sent. Waiting for the homeowner to decide.
<b>Approved</b> — Homeowner said yes. Job is confirmed.
<b>Scheduled</b> — Job has a start date.
<b>In Progress</b> — Work is happening right now.
<b>Invoiced</b> — Bill has been sent. Waiting for payment.
<b>Paid</b> — Payment received. Job is closed. The invoice will show a green PAID stamp when you reprint it.
<b>Tip:</b> Keep your statuses updated. The Analytics section on the dashboard shows your full pipeline — how many jobs are at each stage and how much money is coming.`
  }
];

class ErrorBoundary extends Component {
  constructor(props){super(props);this.state={hasError:false,error:null};}
  static getDerivedStateFromError(e){return{hasError:true,error:e};}
  componentDidCatch(e,info){console.error("Beshert App Error:",e,info);}
  render(){
    if(this.state.hasError){
      return(
        <div style={{fontFamily:"Georgia,serif",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f2f4f7",padding:24}}>
          <div style={{background:"#fff",borderRadius:12,padding:40,maxWidth:480,textAlign:"center",boxShadow:"0 8px 32px rgba(0,0,0,0.1)"}}>
            <div style={{fontSize:48,marginBottom:16}}>⚠️</div>
            <div style={{fontWeight:700,fontSize:18,color:"#1a2744",marginBottom:8}}>Something went wrong</div>
            <div style={{fontSize:13,color:"#666",marginBottom:24,lineHeight:1.6}}>
              The app hit an unexpected error. Your saved data is safe — tap Reload to get back to work.
            </div>
            <button onClick={()=>{this.setState({hasError:false});window.location.reload();}} style={{background:"#8b7cb4",color:"#fff",border:"none",borderRadius:8,padding:"12px 28px",fontSize:14,fontWeight:700,cursor:"pointer"}}>↺ Reload App</button>
            {this.state.error&&<div style={{marginTop:16,fontSize:11,color:"#999",fontFamily:"monospace"}}>Error: {this.state.error.message}</div>}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App(){return<ErrorBoundary><BeshertBuilder/></ErrorBoundary>;}
