import { useState, useEffect, useRef, useCallback } from "react";
import { Upload, FileText, Download, ChevronRight, Shield, Zap, MousePointerClick, ArrowLeft, Check, AlertCircle, X, Search, ChevronDown, Layers, Sparkles, Lock, Unlock } from "lucide-react";

/* ─── field name display cleanup ─── */
const cleanFieldName = (name) => {
  const map = { "Check Box1": "SMS Alerts", "5% DD": "Settlement 5%", "Group7": "Printed Statement", "Group9": "Employment Status", "Group 14": "Auto Settle Bills", "Group16": "Balance Transfer", "ChoiceGroup": "Card Network", "Group2": "Title", "Group5": "Gender", "Group6": "Marital Status", "Group10SUP": "Title (Supplementary)", "Group11": "Gender (Supplementary)", "Group12": "Supplementary Limit", "Group13": "Payment Date" };
  if (map[name]) return map[name];
  let c = name.replace(/[_]/g, " ").replace(/\s+/g, " ").replace(/\d+$/, "").trim();
  if (!c) return name;
  return c.charAt(0).toUpperCase() + c.slice(1);
};

/* ─── radio button display labels ─── */
const RADIO_DISPLAY = {
  ChoiceGroup: { "3": "LankaPay", "0": "Mastercard", "1": "VISA", "2": "UnionPay" },
  Group2: { "0": "Mr.", "1": "Mrs.", "2": "Miss.", "3": "Dr." },
  Group5: { "0": "Male", "1": "Female" },
  Group6: { "0": "Married", "1": "Single" },
};
const getRadioLabel = (fn, bv) => {
  if (RADIO_DISPLAY[fn]?.[bv]) return RADIO_DISPLAY[fn][bv];
  const v = String(bv);
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase().replace(/selfemp/i, "Self-employed");
};

/* ─── section grouping ─── */
const SECS = [
  { key: "choice", label: "Card Type", m: (n) => /^ChoiceGroup$/i.test(n) },
  { key: "personal", label: "Personal Information", m: (n) => /name.*nic|^NIC$|^Passport$|^DOB$|^Nationality$|maiden|Group[256]|qualif|^Name|^Edu|^Mother|^PC Info/i.test(n) },
  { key: "residence", label: "Residence Details", m: (n) => /home.*address [123]$|mailing|^Phone No( |$)|Phone.*Home$|Phone.*Mobile$|^E-mail|^Years$|^Months$|Check Box1|Group7/i.test(n) },
  { key: "relative", label: "Relative Details", m: (n) => /relative|Relationship1|Phone No HomeMobile/i.test(n) },
  { key: "employment", label: "Employment", m: (n) => /employer|business|Designation1|salary|profit|^Office |service|nature|previous|self.*employ|turnover|capital|Group9|Phone No Office/i.test(n) },
  { key: "spouse", label: "Spouse Details", m: (n) => /spouse|annual.*income|Designation2|Name Of Buss/i.test(n) },
  { key: "supp", label: "Supplementary Card", m: (n) => /Group10|Group11|Group12|NAMEONCARD|full.*nic.*_2|NIC 2|PASSPORT2|Nationality_2|Relationship2|Mothers|home.*address_2|Phone.*Home_3|Phone.*Mobile_2|DOB2|^Others$|Others Specify_3/i.test(n) },
  { key: "delivery", label: "Card Delivery & Payment", m: (n) => /deliver|settlement|Group 14|5%|Group13/i.test(n) },
  { key: "transfer", label: "Balance Transfer", m: (n) => /transfer|other.*bank|account.*name|Group16|DOB3|^Amount|credit.*card.*number/i.test(n) },
  { key: "decl", label: "Declaration", m: (n) => /^IWe$|cardholder|^Date/i.test(n) },
  { key: "bank", label: "For Bank Use Only", m: (n) => /Emp No|Department|Lien|Audit|Officer|Recommend|Declined|^Rs$|Branch Mgr/i.test(n) },
];
const getSection = (fn) => { for (const s of SECS) if (s.m(fn)) return s; return { key: "other", label: "Other Fields" }; };

/* ─── styles ─── */
const Styles = () => (<style>{`
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Manrope:wght@300;400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0} body{font-family:'Manrope',sans-serif}
.fh{font-family:'Syne',sans-serif}
@keyframes gs{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
@keyframes fu{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
@keyframes fi{from{opacity:0}to{opacity:1}}
@keyframes sp{to{transform:rotate(360deg)}}
.au{animation:fu .7s cubic-bezier(.16,1,.3,1) both} .ai{animation:fi .5s ease both}
.d1{animation-delay:.1s}.d2{animation-delay:.2s}.d3{animation-delay:.3s}.d4{animation-delay:.4s}.d5{animation-delay:.5s}
.gb{background:linear-gradient(-45deg,#0a0a0a,#1a0a2e,#0a1628,#0f1f0a);background-size:400% 400%;animation:gs 15s ease infinite}
.gl{background:rgba(255,255,255,.03);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.06)}
.if:focus{outline:none;box-shadow:0 0 0 2px #d97706,0 0 12px rgba(217,119,6,.1);border-color:#d97706}
.da{border-color:#d97706!important;background:rgba(217,119,6,.05)!important}
input::placeholder{color:#9ca3af}
::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:#f1f5f9}::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px}
`}</style>);

const Logo = ({sz=18,dark}) => (
  <div style={{display:"flex",alignItems:"center",gap:8,fontSize:sz,fontWeight:800,color:dark?"#0f172a":"#e8e8ed",letterSpacing:"-0.5px"}} className="fh">
    <div style={{width:sz*1.6,height:sz*1.6,borderRadius:sz*0.45,background:"linear-gradient(135deg,#d97706,#f59e0b)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <Layers size={sz*0.9} color={dark?"#fff":"#0a0a0a"} strokeWidth={2.5}/>
    </div>FillBuddy
  </div>
);

/* ─── landing ─── */
const Landing = ({onStart,ready}) => (
  <div className="gb" style={{minHeight:"100vh",color:"#e8e8ed"}}>
    <nav className="ai" style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"24px 40px",maxWidth:1200,margin:"0 auto"}}>
      <Logo sz={22}/>
      <button onClick={onStart} style={{background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.12)",color:"#e8e8ed",padding:"10px 24px",borderRadius:10,cursor:"pointer",fontFamily:"'Manrope',sans-serif",fontSize:14,fontWeight:600,transition:"all .2s"}}
        onMouseEnter={e=>e.target.style.background="rgba(255,255,255,.14)"} onMouseLeave={e=>e.target.style.background="rgba(255,255,255,.08)"}>Open App</button>
    </nav>
    <div style={{maxWidth:1200,margin:"0 auto",padding:"80px 40px 60px",textAlign:"center"}}>
      <div className="au" style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(217,119,6,.1)",border:"1px solid rgba(217,119,6,.2)",borderRadius:100,padding:"6px 18px",marginBottom:32,fontSize:13,fontWeight:600,color:"#f59e0b"}}>
        <Sparkles size={14}/> 100% Client-Side · Your Data Never Leaves
      </div>
      <h1 className="fh au d1" style={{fontSize:"clamp(40px,6vw,72px)",fontWeight:800,lineHeight:1.05,marginBottom:24,letterSpacing:"-2px",maxWidth:800,marginInline:"auto"}}>
        Fill any PDF form.{" "}<span style={{background:"linear-gradient(135deg,#d97706,#fbbf24)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Beautifully.</span>
      </h1>
      <p className="au d2" style={{fontSize:18,lineHeight:1.7,color:"#9ca3af",maxWidth:560,marginInline:"auto",marginBottom:48}}>Upload any fillable PDF, get a clean form interface, fill it out, and download — all in your browser. Works with encrypted PDFs too.</p>
      <div className="au d3">
        <button onClick={onStart} style={{background:"linear-gradient(135deg,#d97706,#b45309)",color:"#fff",border:"none",padding:"16px 40px",borderRadius:14,fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:"'Manrope',sans-serif",transition:"all .25s",boxShadow:"0 4px 30px rgba(217,119,6,.3)"}}
          onMouseEnter={e=>{e.target.style.transform="translateY(-2px)";e.target.style.boxShadow="0 8px 40px rgba(217,119,6,.4)"}}
          onMouseLeave={e=>{e.target.style.transform="";e.target.style.boxShadow="0 4px 30px rgba(217,119,6,.3)"}}>
          Get Started <ChevronRight size={18} style={{display:"inline",verticalAlign:"middle",marginLeft:4}}/>
        </button>
      </div>
      {!ready&&<p className="ai d4" style={{fontSize:12,color:"#6b7280",marginTop:16}}>Loading PDF engines...</p>}
    </div>
    <div style={{maxWidth:1200,margin:"0 auto",padding:"40px 40px 100px",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:20}}>
      {[{icon:<Shield size={24}/>,t:"Private & Secure",d:"Everything runs in your browser. Documents never touch any server."},
        {icon:<Zap size={24}/>,t:"Dual-Engine Smart Detection",d:"Reads fields from any PDF — even encrypted ones — using pdf.js + pdf-lib hybrid engine."},
        {icon:<MousePointerClick size={24}/>,t:"Instant Download",d:"Fill your form with a beautiful UI and download the completed PDF in one click."}
      ].map((f,i)=>(
        <div key={i} className={`gl au d${i+3}`} style={{borderRadius:16,padding:32,transition:"all .3s"}}
          onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,.06)";e.currentTarget.style.transform="translateY(-4px)"}}
          onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,.03)";e.currentTarget.style.transform=""}}>
          <div style={{width:48,height:48,borderRadius:12,background:"rgba(217,119,6,.1)",display:"flex",alignItems:"center",justifyContent:"center",color:"#f59e0b",marginBottom:20}}>{f.icon}</div>
          <h3 className="fh" style={{fontSize:18,fontWeight:700,marginBottom:10,color:"#e8e8ed"}}>{f.t}</h3>
          <p style={{fontSize:14,lineHeight:1.7,color:"#6b7280"}}>{f.d}</p>
        </div>
      ))}
    </div>
  </div>
);

/* ─── upload ─── */
const UploadZone = ({onUpload,onBack,loading,error}) => {
  const [drag,setDrag]=useState(false); const ref=useRef(null);
  const onDrop=useCallback(e=>{e.preventDefault();setDrag(false);const f=e.dataTransfer?.files?.[0];if(f?.type==="application/pdf")onUpload(f)},[onUpload]);
  return (
    <div style={{minHeight:"100vh",background:"#fafafa",display:"flex",flexDirection:"column"}}>
      <nav className="ai" style={{display:"flex",alignItems:"center",gap:16,padding:"20px 40px",borderBottom:"1px solid #e5e7eb"}}>
        <button onClick={onBack} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",fontSize:14,fontWeight:600,color:"#64748b",fontFamily:"'Manrope',sans-serif"}}><ArrowLeft size={18}/>Back</button>
        <Logo sz={18} dark/>
      </nav>
      <div className="au" style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:40}}>
        <h2 className="fh" style={{fontSize:28,fontWeight:800,color:"#0f172a",marginBottom:8,letterSpacing:"-1px"}}>Upload your PDF</h2>
        <p style={{fontSize:15,color:"#64748b",marginBottom:40}}>Drop any fillable PDF — even encrypted ones</p>
        <div onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={onDrop} onClick={()=>ref.current?.click()}
          className={drag?"da":""} style={{width:"100%",maxWidth:520,padding:"60px 40px",borderRadius:20,border:"2px dashed #d1d5db",background:"#fff",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:16,transition:"all .3s",boxShadow:"0 1px 3px rgba(0,0,0,.04)"}}>
          <input ref={ref} type="file" accept=".pdf" onChange={e=>{const f=e.target.files?.[0];if(f)onUpload(f)}} style={{display:"none"}}/>
          {loading?(<>
            <div style={{width:56,height:56,borderRadius:14,background:"#fffbeb",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <div style={{width:24,height:24,border:"3px solid #fde68a",borderTopColor:"#d97706",borderRadius:"50%",animation:"sp .8s linear infinite"}}/>
            </div>
            <p style={{fontSize:15,fontWeight:600,color:"#0f172a"}}>Analyzing form fields...</p>
          </>):(<>
            <div style={{width:64,height:64,borderRadius:16,background:"#fffbeb",display:"flex",alignItems:"center",justifyContent:"center"}}><Upload size={28} color="#d97706"/></div>
            <div style={{textAlign:"center"}}><p style={{fontSize:16,fontWeight:600,color:"#0f172a",marginBottom:4}}>Drop your PDF here or <span style={{color:"#d97706"}}>browse</span></p>
            <p style={{fontSize:13,color:"#9ca3af"}}>Supports fillable & encrypted PDFs</p></div>
          </>)}
        </div>
        {error&&<div className="ai" style={{display:"flex",alignItems:"center",gap:10,marginTop:20,padding:"12px 20px",borderRadius:12,background:"#fef2f2",border:"1px solid #fecaca",color:"#dc2626",fontSize:14,fontWeight:500}}><AlertCircle size={18}/>{error}</div>}
      </div>
    </div>
  );
};

/* ─── field renderer ─── */
const FR = ({field,value,onChange}) => {
  const label = cleanFieldName(field.name);
  if (field.type==="radio") return (
    <div style={{padding:"12px 0",borderBottom:"1px solid #f1f5f9"}}>
      <label style={{display:"block",fontSize:13,fontWeight:600,color:"#374151",marginBottom:10}}>{label}</label>
      <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
        {field.options.map(o=>{const s=value===o.value;return(
          <button key={o.value} onClick={()=>onChange(o.value)}
            style={{padding:"8px 18px",borderRadius:8,fontSize:13,fontWeight:600,fontFamily:"'Manrope',sans-serif",cursor:"pointer",transition:"all .2s",
              background:s?"#fffbeb":"#f8fafc",border:s?"1.5px solid #d97706":"1.5px solid #e2e8f0",color:s?"#92400e":"#64748b"}}>{o.label}</button>
        )})}
      </div>
    </div>
  );
  if (field.type==="checkbox") return (
    <div style={{padding:"12px 0",borderBottom:"1px solid #f1f5f9",display:"flex",alignItems:"center",gap:12}}>
      <button onClick={()=>onChange(!value)} style={{width:22,height:22,borderRadius:6,border:value?"none":"2px solid #d1d5db",background:value?"linear-gradient(135deg,#d97706,#b45309)":"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s",flexShrink:0}}>
        {value&&<Check size={14} color="#fff" strokeWidth={3}/>}</button>
      <label style={{fontSize:13,fontWeight:600,color:"#374151",cursor:"pointer"}} onClick={()=>onChange(!value)}>{label}</label>
    </div>
  );
  return (
    <div style={{padding:"12px 0",borderBottom:"1px solid #f1f5f9"}}>
      <label style={{display:"block",fontSize:12,fontWeight:600,color:"#64748b",marginBottom:6,letterSpacing:".3px",textTransform:"uppercase"}}>{label}</label>
      <input type="text" value={value||""} onChange={e=>onChange(e.target.value)} placeholder={`Enter ${label.toLowerCase()}`} className="if"
        style={{width:"100%",padding:"10px 14px",borderRadius:10,border:"1px solid #e2e8f0",fontSize:14,fontFamily:"'Manrope',sans-serif",color:"#0f172a",background:"#fafafa",transition:"all .2s"}}/>
    </div>
  );
};

/* ─── form filler ─── */
const Filler = ({fields,values,onChange,onDownload,fileName,onBack,saving,mode}) => {
  const [search,setSearch]=useState(""); const [open,setOpen]=useState({}); const [done,setDone]=useState(false);
  const secs={},ord=[];
  fields.forEach(f=>{const s=getSection(f.name);if(!secs[s.key]){secs[s.key]={label:s.label,fields:[]};ord.push(s.key)}secs[s.key].fields.push(f)});
  useEffect(()=>{const o={};ord.forEach(k=>o[k]=true);setOpen(o)},[fields.length]);
  const filled=Object.values(values).filter(v=>v!==""&&v!==false&&v!=null).length;
  const filt=search?Object.fromEntries(Object.entries(secs).map(([k,s])=>[k,{...s,fields:s.fields.filter(f=>cleanFieldName(f.name).toLowerCase().includes(search.toLowerCase()))}]).filter(([,s])=>s.fields.length>0)):secs;
  const dl=async()=>{await onDownload();setDone(true);setTimeout(()=>setDone(false),3000)};

  return (
    <div style={{minHeight:"100vh",background:"#f8fafc",display:"flex",flexDirection:"column"}}>
      <div className="ai" style={{background:"#fff",borderBottom:"1px solid #e5e7eb",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 32px",maxWidth:960,margin:"0 auto",flexWrap:"wrap",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <button onClick={onBack} style={{display:"flex",alignItems:"center",justifyContent:"center",width:36,height:36,borderRadius:10,background:"#f1f5f9",border:"none",cursor:"pointer"}}><ArrowLeft size={18} color="#64748b"/></button>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <FileText size={16} color="#d97706"/><span style={{fontSize:14,fontWeight:700,color:"#0f172a"}}>{fileName}</span>
                <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:6,
                  background:mode==="direct"?"#ecfdf5":"#eff6ff",color:mode==="direct"?"#059669":"#2563eb",border:mode==="direct"?"1px solid #a7f3d0":"1px solid #bfdbfe"}}>
                  {mode==="direct"?<Unlock size={10}/>:<Lock size={10}/>}{mode==="direct"?"Direct Fill":"Visual Overlay"}
                </span>
              </div>
              <span style={{fontSize:12,color:"#94a3b8"}}>{filled} of {fields.length} fields filled</span>
            </div>
          </div>
          <button onClick={dl} disabled={saving}
            style={{display:"flex",alignItems:"center",gap:8,background:done?"#059669":"linear-gradient(135deg,#d97706,#b45309)",color:"#fff",border:"none",padding:"10px 24px",borderRadius:10,
              fontSize:14,fontWeight:700,cursor:saving?"wait":"pointer",fontFamily:"'Manrope',sans-serif",transition:"all .3s",boxShadow:"0 2px 12px rgba(217,119,6,.25)",opacity:saving?.7:1}}>
            {done?<><Check size={16}/> Downloaded!</>:saving?<>Processing...</>:<><Download size={16}/> Download PDF</>}
          </button>
        </div>
        <div style={{height:3,background:"#f1f5f9"}}><div style={{height:"100%",background:"linear-gradient(90deg,#d97706,#f59e0b)",width:`${(filled/fields.length)*100}%`,transition:"width .4s ease",borderRadius:"0 2px 2px 0"}}/></div>
      </div>

      <div style={{maxWidth:960,margin:"0 auto",width:"100%",padding:"20px 32px 0"}}>
        <div className="au" style={{position:"relative"}}>
          <Search size={18} style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:"#94a3b8"}}/>
          <input type="text" placeholder="Search fields..." value={search} onChange={e=>setSearch(e.target.value)} className="if"
            style={{width:"100%",padding:"12px 12px 12px 42px",borderRadius:12,border:"1px solid #e2e8f0",fontSize:14,fontFamily:"'Manrope',sans-serif",background:"#fff",transition:"all .2s"}}/>
          {search&&<button onClick={()=>setSearch("")} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer"}}><X size={16} color="#94a3b8"/></button>}
        </div>
      </div>

      <div style={{maxWidth:960,margin:"0 auto",width:"100%",padding:"16px 32px 100px"}}>
        {(search?Object.keys(filt):ord).map((k,si)=>{const sec=filt[k]||secs[k];if(!sec||!sec.fields.length)return null;const io=search||open[k]!==false;
          return(<div key={k} className={`au d${Math.min(si,3)}`} style={{marginBottom:12}}>
            <button onClick={()=>!search&&setOpen(p=>({...p,[k]:!p[k]}))}
              style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",padding:"14px 20px",background:"#fff",border:"1px solid #e2e8f0",borderRadius:io?"14px 14px 0 0":14,cursor:"pointer",fontFamily:"'Manrope',sans-serif",transition:"all .2s"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:sec.fields.some(f=>values[f.name]&&values[f.name]!==false)?"#059669":"#d1d5db"}}/>
                <span className="fh" style={{fontSize:14,fontWeight:700,color:"#0f172a"}}>{sec.label}</span>
                <span style={{fontSize:12,color:"#94a3b8",fontWeight:500}}>{sec.fields.length}</span>
              </div>
              <ChevronDown size={18} color="#94a3b8" style={{transform:io?"rotate(180deg)":"",transition:"transform .2s"}}/>
            </button>
            {io&&<div style={{background:"#fff",border:"1px solid #e2e8f0",borderTop:"none",borderRadius:"0 0 14px 14px",padding:"8px 20px 16px"}}>
              {sec.fields.map(f=><FR key={f.name} field={f} value={values[f.name]} onChange={v=>onChange(f.name,v)}/>)}
            </div>}
          </div>)
        })}
        {search&&!Object.keys(filt).length&&<div style={{textAlign:"center",padding:60,color:"#94a3b8"}}><Search size={32} style={{marginBottom:12,opacity:.4}}/><p style={{fontSize:15,fontWeight:500}}>No fields match "{search}"</p></div>}
      </div>
    </div>
  );
};

/* ═══════════════ MAIN APP ═══════════════ */
export default function FillBuddy() {
  const [view,setView]=useState("landing");
  const [libs,setLibs]=useState({pdfjs:null,pdflib:null});
  const [pdfBytes,setPdfBytes]=useState(null);
  const [fields,setFields]=useState([]);
  const [values,setValues]=useState({});
  const [fileName,setFileName]=useState("");
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [mode,setMode]=useState("direct");

  /* load libs */
  useEffect(()=>{
    let ok=true; const L={pdfjs:null,pdflib:null};
    const chk=()=>{if(L.pdfjs&&L.pdflib&&ok)setLibs({...L})};
    const s1=document.createElement("script");
    s1.src="https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js";
    s1.onload=()=>{L.pdflib=window.PDFLib;chk()};
    document.head.appendChild(s1);
    const s2=document.createElement("script");
    s2.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s2.onload=()=>{const p=window.pdfjsLib;p.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";L.pdfjs=p;chk()};
    document.head.appendChild(s2);
    return ()=>{ok=false};
  },[]);

  /* extract with pdf.js (handles encrypted) */
  const exPdfJs=useCallback(async(bytes)=>{
    const doc=await libs.pdfjs.getDocument({data:new Uint8Array(bytes)}).promise;
    const rg={},all=[],seen=new Set();
    for(let i=1;i<=doc.numPages;i++){
      const pg=await doc.getPage(i);
      const an=await pg.getAnnotations();
      for(const a of an){
        if(!a.fieldType)continue;
        if(a.fieldType==="Btn"&&a.radioButton){
          if(!rg[a.fieldName])rg[a.fieldName]={name:a.fieldName,type:"radio",options:[]};
          rg[a.fieldName].options.push({value:String(a.buttonValue),label:getRadioLabel(a.fieldName,a.buttonValue),rect:a.rect,page:i});
        } else if(a.fieldType==="Btn"&&a.checkBox){
          if(!seen.has(a.fieldName)){seen.add(a.fieldName);all.push({name:a.fieldName,type:"checkbox",rect:a.rect,page:i});}
        } else if(a.fieldType==="Tx"){
          if(!seen.has(a.fieldName)){seen.add(a.fieldName);all.push({name:a.fieldName,type:"text",rect:a.rect,page:i,value:a.fieldValue||""});}
        }
      }
    }
    // Build ordered list
    const ordered=[],done2=new Set();
    for(let i=1;i<=doc.numPages;i++){
      const pg=await doc.getPage(i); const an=await pg.getAnnotations();
      for(const a of an){if(!a.fieldType||done2.has(a.fieldName))continue;done2.add(a.fieldName);
        if(rg[a.fieldName])ordered.push(rg[a.fieldName]); else{const f=all.find(x=>x.name===a.fieldName);if(f)ordered.push(f);}
      }
    }
    return ordered;
  },[libs.pdfjs]);

  /* extract with pdf-lib (for unencrypted) */
  const exPdfLib=useCallback(async(bytes)=>{
    const doc=await libs.pdflib.PDFDocument.load(bytes);
    const form=doc.getForm(); const raw=form.getFields();
    if(!raw.length)return null;
    return raw.map(f=>{
      const n=f.getName(),t=f.constructor.name;
      if(t==="PDFCheckBox")return{name:n,type:"checkbox",pdfLib:true};
      if(t==="PDFRadioGroup"){let o=[];try{o=f.getOptions()}catch{}return{name:n,type:"radio",pdfLib:true,options:o.map((v,i)=>({value:v,label:getRadioLabel(n,v)}))};}
      if(t==="PDFDropdown"||t==="PDFOptionList"){let o=[];try{o=f.getOptions()}catch{}return{name:n,type:"dropdown",pdfLib:true,options:o};}
      let v="";try{v=f.getText()||""}catch{}return{name:n,type:"text",pdfLib:true,value:v};
    });
  },[libs.pdflib]);

  /* upload */
  const handleUpload=useCallback(async(file)=>{
    if(!libs.pdflib||!libs.pdfjs){setError("Engines loading...");return}
    setLoading(true);setError("");
    try{
      const bytes=await file.arrayBuffer();
      let result=null,m="direct";
      try{result=await exPdfLib(bytes)}catch{}
      if(!result||!result.length){m="overlay";result=await exPdfJs(bytes)}
      if(!result||!result.length){setError("No fillable form fields found.");setLoading(false);return}
      const iv={};result.forEach(f=>{iv[f.name]=f.type==="checkbox"?false:f.value||""});
      setPdfBytes(new Uint8Array(bytes));setFields(result);setValues(iv);setFileName(file.name);setMode(m);setView("filling");
    }catch(e){console.error(e);setError("Could not parse: "+e.message)}
    setLoading(false);
  },[libs,exPdfLib,exPdfJs]);

  /* download: direct */
  const dlDirect=useCallback(async()=>{
    const doc=await libs.pdflib.PDFDocument.load(pdfBytes);
    const form=doc.getForm();
    Object.entries(values).forEach(([n,v])=>{try{const f=form.getField(n),t=f.constructor.name;
      if(t==="PDFTextField")f.setText(v||"");
      else if(t==="PDFCheckBox"){if(v)f.check();else f.uncheck()}
      else if(t==="PDFRadioGroup"&&v)f.select(v);
      else if((t==="PDFDropdown"||t==="PDFOptionList")&&v)f.select(v);
    }catch{}});
    form.flatten();return await doc.save();
  },[libs.pdflib,pdfBytes,values]);

  /* download: overlay (encrypted) */
  const dlOverlay=useCallback(async()=>{
    const{PDFDocument,StandardFonts,rgb}=libs.pdflib;
    const src=await libs.pdfjs.getDocument({data:new Uint8Array(pdfBytes)}).promise;
    const nd=await PDFDocument.create();
    const font=await nd.embedFont(StandardFonts.Helvetica);

    for(let i=1;i<=src.numPages;i++){
      const sp=await src.getPage(i);
      const vp=sp.getViewport({scale:1});
      const W=vp.width,H=vp.height,sc=3;
      const cv=document.createElement("canvas");cv.width=W*sc;cv.height=H*sc;
      await sp.render({canvasContext:cv.getContext("2d"),viewport:sp.getViewport({scale:sc})}).promise;
      const blob=await new Promise(r=>cv.toBlob(r,"image/png"));
      const ib=new Uint8Array(await blob.arrayBuffer());
      const img=await nd.embedPng(ib);
      const pg=nd.addPage([W,H]);
      pg.drawImage(img,{x:0,y:0,width:W,height:H});

      const pf=fields.filter(f=>f.page===i||(f.options&&f.options.some(o=>o.page===i)));
      pf.forEach(f=>{
        const v=values[f.name];if(v===""||v===false||v==null)return;
        if(f.type==="text"&&f.rect){
          const[x1,y1,x2,y2]=f.rect;const fh=y2-y1;const fs=Math.min(fh*.72,10);
          pg.drawText(String(v),{x:x1+2,y:y1+fh*.25,size:fs,font,color:rgb(0,0,0)});
        }else if(f.type==="radio"&&f.options){
          const opt=f.options.find(o=>o.value===v&&o.page===i);
          if(opt){const[x1,y1,x2,y2]=opt.rect;pg.drawCircle({x:(x1+x2)/2,y:(y1+y2)/2,size:Math.min(x2-x1,y2-y1)*.28,color:rgb(0,0,0)})}
        }else if(f.type==="checkbox"&&v&&f.rect){
          const[x1,y1,x2,y2]=f.rect;const cx=(x1+x2)/2,cy=(y1+y2)/2,s=(x2-x1)*.3;
          pg.drawLine({start:{x:cx-s,y:cy},end:{x:cx-s*.2,y:cy-s*.8},thickness:1.5,color:rgb(0,0,0)});
          pg.drawLine({start:{x:cx-s*.2,y:cy-s*.8},end:{x:cx+s,y:cy+s*.7},thickness:1.5,color:rgb(0,0,0)});
        }
      });
    }
    return await nd.save();
  },[libs,pdfBytes,fields,values]);

  /* download dispatch */
  const handleDL=useCallback(async()=>{
    setSaving(true);
    try{
      const b=mode==="direct"?await dlDirect():await dlOverlay();
      const blob=new Blob([b],{type:"application/pdf"});
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");a.href=url;a.download=`filled_${fileName}`;
      document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
    }catch(e){console.error(e);setError("Download failed: "+e.message)}
    setSaving(false);
  },[mode,dlDirect,dlOverlay,fileName]);

  const chg=useCallback((n,v)=>setValues(p=>({...p,[n]:v})),[]);
  const reset=()=>{setView("upload");setFields([]);setValues({});setPdfBytes(null);setFileName("");setError("")};

  return (
    <div style={{fontFamily:"'Manrope',sans-serif"}}>
      <Styles/>
      {view==="landing"&&<Landing onStart={()=>setView("upload")} ready={!!(libs.pdfjs&&libs.pdflib)}/>}
      {view==="upload"&&<UploadZone onUpload={handleUpload} onBack={()=>setView("landing")} loading={loading} error={error}/>}
      {view==="filling"&&<Filler fields={fields} values={values} onChange={chg} onDownload={handleDL} fileName={fileName} onBack={reset} saving={saving} mode={mode}/>}
    </div>
  );
}
