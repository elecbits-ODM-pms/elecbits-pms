import { useState, useRef } from "react";

/* ─── THEME SYSTEM ─────────────────────────────────────────────*/
const DARK = {
  "--bg":"#0c0e13","--s1":"#111520","--s2":"#161c2a","--s3":"#1e2740",
  "--bdr":"#1f2d4a","--bdr2":"#2a3d60","--card":"#111520",
  "--txt":"#e2e8f5","--txt2":"#7a90b8","--txt3":"#3d5080",
  "--acc":"#00c8ff","--green":"#00e096","--red":"#ff3d5a","--amber":"#ffb830","--blue":"#00c8ff","--purple":"#c678ff","--coral":"#ff6b35",
  "--shadow":"0 2px 12px #0008",
};
const LIGHT = {
  "--bg":"#f0f2f7","--s1":"#ffffff","--s2":"#f5f7fb","--s3":"#e8ecf4",
  "--bdr":"#dde2ef","--bdr2":"#c5cde0","--card":"#ffffff",
  "--txt":"#1a1f30","--txt2":"#5a6478","--txt3":"#9099b0",
  "--acc":"#0096c7","--green":"#00a873","--red":"#e02044","--amber":"#d97706","--blue":"#0096c7","--purple":"#7c3aed","--coral":"#ea580c",
  "--shadow":"0 2px 12px #0002",
};

const applyTheme=(isDark)=>{
  const vars=isDark?DARK:LIGHT;
  Object.entries(vars).forEach(([k,v])=>document.documentElement.style.setProperty(k,v));
};

const G=({isDark})=>(
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Manrope:wght@300;400;500;600;700;800&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    html,body,#root{height:100%;background:var(--bg);color:var(--txt);font-family:'Manrope',sans-serif;font-size:14px;-webkit-font-smoothing:antialiased;transition:background .25s,color .25s}
    input,select,textarea,button{font-family:'Manrope',sans-serif;transition:background .2s,border-color .2s,color .2s}
    ::-webkit-scrollbar{width:4px;height:4px}
    ::-webkit-scrollbar-track{background:var(--s2)}
    ::-webkit-scrollbar-thumb{background:var(--bdr2);border-radius:2px}
    @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
    @keyframes spin{to{transform:rotate(360deg)}}
    .fade{animation:fadeUp .25s ease both}
    input[type=checkbox]{accent-color:var(--acc);width:15px;height:15px;cursor:pointer}
    table{border-collapse:collapse;width:100%}
    th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--bdr);font-size:12px}
    th{font-size:10px;font-weight:700;color:var(--txt2);letter-spacing:.07em;text-transform:uppercase;font-family:'IBM Plex Mono',monospace;background:var(--s2);white-space:nowrap}
    tbody tr:hover td{background:var(--s2)}
    td{vertical-align:top}
    .card{background:var(--card);border:1px solid var(--bdr);border-radius:10px}
    .inp-base{width:100%;background:var(--bg);border:1px solid var(--bdr);border-radius:6px;color:var(--txt);padding:7px 10px;font-size:12px;outline:none}
    .inp-base:focus{border-color:var(--acc)}
    select option{background:var(--s1);color:var(--txt)}
  `}</style>
);

/* ─── CONSTANTS ────────────────────────────────────────────────*/
const RESOURCE_ROLES=[
  {key:"sr_hw",label:"Sr. Hardware",tier:"senior",maxProjects:4,color:"var(--amber)"},
  {key:"jr_hw",label:"Jr. Hardware",tier:"junior",maxProjects:2,color:"var(--amber)"},
  {key:"sr_fw",label:"Sr. Firmware",tier:"senior",maxProjects:4,color:"var(--blue)"},
  {key:"jr_fw",label:"Jr. Firmware",tier:"junior",maxProjects:2,color:"var(--blue)"},
  {key:"tester",label:"Tester",tier:"junior",maxProjects:2,color:"var(--green)"},
  {key:"ind_design",label:"Industrial Design",tier:"junior",maxProjects:2,color:"var(--purple)"},
  {key:"sr_pm",label:"Senior PM",tier:"senior",maxProjects:4,color:"var(--coral)"},
  {key:"jr_pm",label:"Junior PM",tier:"junior",maxProjects:2,color:"var(--coral)"},
  {key:"sol_arch",label:"Solution Architects",tier:"shared",maxProjects:4,color:"var(--acc)"},
  {key:"devops",label:"DevOps",tier:"shared",maxProjects:4,color:"var(--acc)"},
  {key:"sc",label:"Supply Chain",tier:"shared",maxProjects:4,color:"var(--purple)"},
  {key:"soldering",label:"Soldering & Testing",tier:"junior",maxProjects:2,color:"var(--coral)"},
];
const HIRING_BASE={sr_hw:{req4:1,target17:4,achieved:2},jr_hw:{req4:2,target17:9,achieved:5},sr_fw:{req4:1,target17:4,achieved:3},jr_fw:{req4:3,target17:13,achieved:7},tester:{req4:1,target17:4,achieved:0},ind_design:{req4:1,target17:4,achieved:1},sr_pm:{req4:1,target17:4,achieved:1},jr_pm:{req4:2,target17:9,achieved:6},sol_arch:{req4:1,target17:4,achieved:0},devops:{req4:1,target17:4,achieved:0},sc:{req4:1,target17:4,achieved:0},soldering:{req4:1,target17:4,achieved:0}};
const PROJECT_TAGS=[{key:"engineering",label:"Engineering Project",color:"var(--blue)"},{key:"elecbits_product",label:"Elecbits Product",color:"var(--green)"},{key:"modifier",label:"Modifier",color:"var(--purple)"}];
const tagColor=(k)=>PROJECT_TAGS.find(t=>t.key===k)?.color||"var(--txt3)";
const tagLabel=(k)=>PROJECT_TAGS.find(t=>t.key===k)?.label||k;

const CHECKLIST_DEFS=[
  {key:"gantt",label:"Full Project Gantt Chart",icon:"📊",multi:false,color:"var(--blue)"},
  {key:"pm_milestone",label:"PM / Milestone Checklist",icon:"🎯",multi:false,color:"var(--purple)"},
  {key:"hw_design",label:"HW / Hardware Checklist",icon:"⬡",multi:false,color:"var(--amber)"},
  {key:"hw_testing",label:"Hardware Testing Checklist",icon:"🔬",multi:false,color:"var(--amber)"},
  {key:"fw_logic",label:"Firmware — Logic Checklist",icon:"◈",multi:false,color:"var(--blue)"},
  {key:"fw_testing",label:"Firmware Testing Checklist",icon:"🧪",multi:false,color:"var(--blue)"},
  {key:"id_design",label:"Industrial Design Checklist",icon:"◉",multi:false,color:"var(--green)"},
  {key:"id_testing",label:"Industrial Design Testing",icon:"📐",multi:false,color:"var(--green)"},
  {key:"overall_testing",label:"Overall Testing",icon:"✅",multi:false,color:"var(--green)"},
  {key:"production",label:"Production Checklist",icon:"🏭",multi:true,color:"var(--red)"},
];
const DEFAULT_ITEMS={gantt:["Project kick-off date confirmed","Milestone dates agreed","Phase 1 (HW) timeline locked","Phase 2 (FW) timeline locked","Phase 3 (ID) timeline locked","Supply chain lead time mapped","Buffer weeks allocated","Client review dates scheduled","Final delivery date confirmed","Gantt shared and approved"],pm_milestone:["Kick-off meeting done","NDA / contract signed","Spec document v1 approved","BOM approved","Design review completed","Prototype 1 sign-off","Client feedback incorporated","Final spec locked","Delivery schedule confirmed","Project closure checklist done"],hw_design:["Schematic v1 drafted","Power architecture reviewed","Signal integrity checked","BOM finalized","PCB layout done","Design rule check passed","Gerber files generated","Schematic peer reviewed","Component availability verified","Final schematic sign-off"],hw_testing:["Prototype assembled","Power-on test done","Voltage rail checks done","Current consumption measured","Communication interfaces tested","Thermal testing done","EMI pre-scan done","Functional test pass","Failure analysis documented","Test report generated"],fw_logic:["Architecture doc drafted","Bootloader configured","RTOS / bare-metal setup","Driver layer done","Application logic done","Unit tests written","Code review done","Static analysis done","Build reproducible","Firmware version tagged"],fw_testing:["Test plan written","Smoke test pass","Feature test pass","Regression suite run","Edge case tests done","Memory leak check","OTA update tested","Final firmware locked","Test report generated","Firmware flashed on pilot units"],id_design:["Initial sketches approved","CAD model v1 done","DFM review done","Tooling feasibility confirmed","Material selection finalized","Color / finish confirmed","Enclosure BOM done","3D print prototype approved","Drawings released","ID sign-off done"],id_testing:["3D print fit-check done","Assembly test done","Drop test done","Ingress protection tested","Label placement verified","Cosmetic inspection done","Tooling first article done","Client sample approved","Mass production sample approved","ID test report generated"],overall_testing:["All subsystems integrated","System-level test plan done","Happy-path tests done","Stress tests done","Compatibility tests done","Safety tests done","Regulatory compliance verified","Third-party lab report received","Final test sign-off","Product approved for production"]};
const genProdItems=(u)=>[`PO confirmed — ${u} units`,"BOM finalized","Component procurement started","PCB fab order placed","PCBA order placed","Enclosure tooling confirmed","First article inspection done",`SMT line programmed for ${u} units`,"ICT fixtures ready","Functional test fixtures ready",`Pilot run (10% of ${u}) completed`,"Pilot defect rate < 1%","Full production run started",`${u} units assembled`,"Final QC done","Packaging confirmed","Serial numbers applied",`${u} units dispatched`];
const mkItem=(text,i)=>({id:`${i}-${Math.random().toString(36).slice(2,6)}`,text,done:false,status:"Pending",tmApproval:"Pending",pmApproval:"Pending",clientApproval:"Pending",link:"",remarks:"",lastUpdated:new Date().toISOString().slice(0,10),comments:[],roadblocks:[],files:[]});

// Checklist → which resource roles can edit it (domain ownership)
const CL_OWNERS={
  gantt:["sr_pm","jr_pm"],
  pm_milestone:["sr_pm","jr_pm"],
  hw_design:["sr_hw","jr_hw"],
  hw_testing:["sr_hw","jr_hw","tester"],
  fw_logic:["sr_fw","jr_fw"],
  fw_testing:["sr_fw","jr_fw","tester"],
  id_design:["ind_design"],
  id_testing:["ind_design","tester"],
  overall_testing:["tester","sr_hw","sr_fw"],
  production:["sr_pm","jr_pm","sc","soldering","tester"],
};
// Can user edit this checklist?
const canEditCL=(user,clKey)=>{
  if(user.role==="superadmin"||user.role==="pm")return true;
  const allowed=CL_OWNERS[clKey]||[];
  return allowed.includes(user.resourceRole);
};

/* ─── INITIAL DATA ─────────────────────────────────────────────*/
let UID_COUNTER=11;
const mkUID=()=>UID_COUNTER++;
const INIT_USERS=[
  {id:1,name:"Aryan Sharma",email:"aryan@elecbits.in",role:"superadmin",avatar:"AS",dept:"Management",resourceRole:"sr_pm",loginType:"admin"},
  {id:2,name:"Priya Mehta",email:"priya@elecbits.in",role:"pm",avatar:"PM",dept:"Project Management",resourceRole:"sr_pm",loginType:"pm"},
  {id:3,name:"Rohan Das",email:"rohan@elecbits.in",role:"pm",avatar:"RD",dept:"Project Management",resourceRole:"jr_pm",loginType:"pm"},
  {id:4,name:"Rohit Kumar",email:"rohit@elecbits.in",role:"developer",avatar:"RK",dept:"Hardware",domain:"HW",resourceRole:"sr_hw",loginType:"developer"},
  {id:5,name:"Sneha Iyer",email:"sneha@elecbits.in",role:"developer",avatar:"SI",dept:"Firmware",domain:"FW",resourceRole:"sr_fw",loginType:"developer"},
  {id:6,name:"Karan Verma",email:"karan@elecbits.in",role:"developer",avatar:"KV",dept:"Industrial Design",domain:"ID",resourceRole:"ind_design",loginType:"developer"},
  {id:7,name:"Amit Joshi",email:"amit@elecbits.in",role:"developer",avatar:"AJ",dept:"Supply Chain",domain:"SC",resourceRole:"sc",loginType:"developer"},
  {id:8,name:"Divya Nair",email:"divya@elecbits.in",role:"developer",avatar:"DN",dept:"Testing",domain:"Testing",resourceRole:"tester",loginType:"developer"},
  {id:9,name:"Dev Sharma",email:"dev@elecbits.in",role:"developer",avatar:"DS",dept:"Firmware",domain:"FW",resourceRole:"jr_fw",loginType:"developer"},
  {id:10,name:"Meera Pillai",email:"meera@elecbits.in",role:"developer",avatar:"MP",dept:"Hardware",domain:"HW",resourceRole:"jr_hw",loginType:"developer"},
];
const INIT_PASSWORDS={"aryan@elecbits.in":"admin123","priya@elecbits.in":"pm123","rohan@elecbits.in":"pm123","rohit@elecbits.in":"dev123","sneha@elecbits.in":"dev123","karan@elecbits.in":"dev123","amit@elecbits.in":"dev123","divya@elecbits.in":"dev123","dev@elecbits.in":"dev123","meera@elecbits.in":"dev123"};

const INIT_PROJECTS=[
  {id:1,name:"Smart Plug v2",projectId:"EB-2401",productId:"PD-110",projectTag:"elecbits_product",description:"Wi-Fi enabled smart plug with energy monitoring. Target markets EU + US.",startDate:"2025-01-02",endDate:"2025-04-30",rag:"green",sanctioned:true,teamAssignments:[{userId:1,role:"Senior PM",startDate:"2025-01-02",endDate:"2025-04-30"},{userId:2,role:"PM",startDate:"2025-01-02",endDate:"2025-04-30"},{userId:4,role:"HW Engineer",startDate:"2025-01-05",endDate:"2025-03-15"},{userId:5,role:"FW Engineer",startDate:"2025-02-01",endDate:"2025-04-20"},{userId:6,role:"ID Engineer",startDate:"2025-01-10",endDate:"2025-03-30"},{userId:7,role:"Supply Chain",startDate:"2025-01-15",endDate:"2025-04-30"},{userId:8,role:"Tester",startDate:"2025-03-01",endDate:"2025-04-30"}],checklists:{},communications:[],reminders:[]},
  {id:2,name:"EVSO Controller",projectId:"EB-2403",productId:"PD-120",projectTag:"engineering",description:"EV supply object controller with CAN bus. Fleet charging stations.",startDate:"2025-01-15",endDate:"2025-06-30",rag:"red",sanctioned:true,teamAssignments:[{userId:1,role:"Senior PM",startDate:"2025-01-15",endDate:"2025-06-30"},{userId:2,role:"PM",startDate:"2025-01-15",endDate:"2025-06-30"},{userId:4,role:"HW Engineer",startDate:"2025-01-20",endDate:"2025-05-15"},{userId:5,role:"FW Engineer",startDate:"2025-03-01",endDate:"2025-06-30"},{userId:6,role:"ID Engineer",startDate:"2025-02-01",endDate:"2025-04-30"},{userId:7,role:"Supply Chain",startDate:"2025-02-15",endDate:"2025-06-30"},{userId:8,role:"Tester",startDate:"2025-05-01",endDate:"2025-06-30"}],checklists:{},communications:[],reminders:[]},
  {id:3,name:"Pro-Connect HMI",projectId:"EB-2404",productId:"PD-130",projectTag:"engineering",description:"Industrial HMI panel 7-inch capacitive touchscreen. RS485/Modbus.",startDate:"2025-02-01",endDate:"2025-05-20",rag:"amber",sanctioned:false,teamAssignments:[{userId:1,role:"Senior PM",startDate:"2025-02-01",endDate:"2025-05-20"},{userId:3,role:"PM",startDate:"2025-02-01",endDate:"2025-05-20"},{userId:4,role:"HW Engineer",startDate:"2025-02-05",endDate:"2025-04-30"},{userId:5,role:"FW Engineer",startDate:"2025-03-01",endDate:"2025-05-20"},{userId:6,role:"ID Engineer",startDate:"2025-02-10",endDate:"2025-04-20"},{userId:7,role:"Supply Chain",startDate:"2025-03-01",endDate:"2025-05-20"},{userId:8,role:"Tester",startDate:"2025-04-15",endDate:"2025-05-20"}],checklists:{},communications:[],reminders:[]},
  {id:4,name:"Voice Controller",projectId:"EB-2405",productId:"PD-140",projectTag:"modifier",description:"Far-field voice controller 4-mic array. Alexa & Google Assistant compatible.",startDate:"2025-02-05",endDate:"2025-05-10",rag:"green",sanctioned:true,teamAssignments:[{userId:1,role:"Senior PM",startDate:"2025-02-05",endDate:"2025-05-10"},{userId:2,role:"PM",startDate:"2025-02-05",endDate:"2025-05-10"},{userId:4,role:"HW Engineer",startDate:"2025-02-10",endDate:"2025-04-15"},{userId:9,role:"FW Engineer",startDate:"2025-03-01",endDate:"2025-05-10"},{userId:6,role:"ID Engineer",startDate:"2025-02-15",endDate:"2025-04-10"},{userId:10,role:"HW Support",startDate:"2025-03-01",endDate:"2025-04-30"},{userId:8,role:"Tester",startDate:"2025-04-01",endDate:"2025-05-10"}],checklists:{},communications:[],reminders:[]},
];

/* ─── HELPERS ──────────────────────────────────────────────────*/
const todayStr=()=>new Date().toISOString().slice(0,10);
const daysLeft=(d)=>Math.ceil((new Date(d)-new Date())/86400000);
const ragColor=(r)=>r==="green"?"var(--green)":r==="red"?"var(--red)":"var(--amber)";
const fmtDate=(d)=>d?new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}):"—";
const fmtShort=(d)=>d?new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short"}):"—";
const UNIQ=()=>Math.random().toString(36).slice(2,9);
const initials=(name)=>name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
const avColors=["#00c8ff","#ff6b35","#00e096","#ffb830","#c678ff","#ff3d5a","#4ecdc4","#f7b731","#a29bfe","#fd79a8","#26de81","#fd9644"];

const getUser=(id,users)=>users.find(x=>x.id===id);
const nonAdmins=(users)=>users.filter(u=>u.role!=="superadmin");
const userCap=(u)=>RESOURCE_ROLES.find(r=>r.key===u?.resourceRole)?.maxProjects||2;
const activeProjs=(uid,projects,onDate=todayStr())=>projects.filter(p=>p.teamAssignments?.some(a=>a.userId===uid&&a.startDate<=onDate&&(a.endDate||"9999")>=onDate));
const getPM=(p,users)=>{const a=p.teamAssignments?.find(x=>["PM","Junior PM","Project Manager"].some(r=>x.role.includes(r))&&x.userId!==1);return a?getUser(a.userId,users):null;};

/* ─── HALF-MONTH COHORTS ───────────────────────────────────────*/
const getHalfMonths=(fromDate,count=6)=>{
  const periods=[];
  const d=new Date(fromDate);
  d.setDate(1);
  for(let i=0;i<count;i++){
    const y=d.getFullYear(),m=d.getMonth();
    const lastDay=new Date(y,m+1,0).getDate();
    periods.push({label:`1–15 ${d.toLocaleDateString("en-IN",{month:"short",year:"2-digit"})}`,start:`${y}-${String(m+1).padStart(2,"0")}-01`,end:`${y}-${String(m+1).padStart(2,"0")}-15`});
    periods.push({label:`16–${lastDay} ${d.toLocaleDateString("en-IN",{month:"short",year:"2-digit"})}`,start:`${y}-${String(m+1).padStart(2,"0")}-16`,end:`${y}-${String(m+1).padStart(2,"0")}-${lastDay}`});
    d.setMonth(d.getMonth()+1);
  }
  return periods;
};

/* ─── ATOMS ────────────────────────────────────────────────────*/
const Av=({uid,size=30,users})=>{
  const u=getUser(uid,users||INIT_USERS);
  const c=avColors[((uid||1)-1)%avColors.length];
  return <div style={{width:size,height:size,borderRadius:"50%",background:`${c}22`,border:`1.5px solid ${c}60`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.32,fontWeight:700,color:c,flexShrink:0,fontFamily:"IBM Plex Mono"}}>{u?.avatar||"?"}</div>;
};
const Pill=({label,color,small,dot=true})=>(
  <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:small?"2px 7px":"3px 10px",borderRadius:99,fontSize:small?9:10,fontWeight:700,fontFamily:"IBM Plex Mono",letterSpacing:"0.04em",background:`${color||"var(--txt3)"}18`,color:color||"var(--txt2)",border:`1px solid ${color||"var(--txt3)"}40`,whiteSpace:"nowrap"}}>
    {dot&&<span style={{width:5,height:5,borderRadius:"50%",background:color||"var(--txt3)",flexShrink:0}}/>}{label}
  </span>
);
const Tag=({label,color})=>(
  <span style={{padding:"1px 7px",borderRadius:3,fontSize:10,fontWeight:600,background:`${color||"var(--txt3)"}18`,color:color||"var(--txt3)",border:`1px solid ${color||"var(--txt3)"}35`,whiteSpace:"nowrap",fontFamily:"IBM Plex Mono"}}>{label}</span>
);
const Bar=({val,color,thin})=>(
  <div style={{display:"flex",alignItems:"center",gap:6}}>
    <div style={{flex:1,height:thin?3:5,background:"var(--bdr)",borderRadius:99,overflow:"hidden"}}><div style={{width:`${Math.max(0,Math.min(100,val||0))}%`,height:"100%",background:color||(val>=70?"var(--green)":val>=40?"var(--blue)":"var(--amber)"),borderRadius:99}}/></div>
    <span style={{fontSize:10,fontWeight:700,color:"var(--txt2)",fontFamily:"IBM Plex Mono",minWidth:26}}>{val||0}%</span>
  </div>
);
const Inp=({style:s,...p})=>(
  <input {...p} className="inp-base" style={{...s}} onFocus={e=>e.target.style.borderColor="var(--acc)"} onBlur={e=>e.target.style.borderColor="var(--bdr)"}/>
);
const Sel=({children,style:s,...p})=>(
  <select {...p} className="inp-base" style={{cursor:"pointer",...s}}>{children}</select>
);
const TA=({style:s,...p})=>(
  <textarea {...p} className="inp-base" style={{resize:"vertical",...s}} onFocus={e=>e.target.style.borderColor="var(--acc)"} onBlur={e=>e.target.style.borderColor="var(--bdr)"}/>
);
const Btn=({children,v="primary",style:s,...p})=>{
  const vs={primary:{background:"var(--acc)",color:"#fff",border:"none"},secondary:{background:"var(--s3)",color:"var(--txt)",border:"1px solid var(--bdr)"},danger:{background:"var(--red)",color:"#fff",border:"none"},ghost:{background:"transparent",color:"var(--acc)",border:"1px solid var(--bdr2)"},success:{background:"var(--green)",color:"#fff",border:"none"},amber:{background:"var(--amber)",color:"#fff",border:"none"},purple:{background:"var(--purple)",color:"#fff",border:"none"}};
  return <button {...p} style={{padding:"7px 14px",borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer",transition:"all .15s",display:"inline-flex",alignItems:"center",gap:5,...vs[v],...s}}>{children}</button>;
};
const Lbl=({children,style:s})=><div style={{fontSize:10,fontWeight:700,color:"var(--txt2)",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:4,fontFamily:"IBM Plex Mono",...s}}>{children}</div>;
const Card=({children,style:s,onClick})=><div onClick={onClick} className="card" style={{...s}}>{children}</div>;
const Divider=()=><div style={{height:1,background:"var(--bdr)",margin:"16px 0"}}/>;
const SH=({title,action,color})=>(
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
    <div style={{fontSize:10,color:"var(--txt2)",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"IBM Plex Mono",display:"flex",alignItems:"center",gap:8}}><span style={{width:3,height:14,background:color||"var(--acc)",borderRadius:2}}/>{title}</div>
    {action}
  </div>
);
const Stat=({label,value,color,sub})=>(
  <Card style={{padding:"13px 16px"}}>
    <div style={{fontSize:10,color:"var(--txt2)",fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",fontFamily:"IBM Plex Mono",marginBottom:5}}>{label}</div>
    <div style={{fontSize:24,fontWeight:800,color:color||"var(--txt)",lineHeight:1}}>{value}</div>
    {sub&&<div style={{fontSize:10,color:"var(--txt2)",marginTop:3}}>{sub}</div>}
  </Card>
);
const Modal=({title,children,onClose,wide,maxW})=>(
  <div style={{position:"fixed",inset:0,background:"#00000080",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(4px)"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div className="card" style={{width:"100%",maxWidth:maxW||(wide?940:520),maxHeight:"92vh",overflow:"auto",animation:"fadeUp .2s ease",boxShadow:"var(--shadow)"}}>
      <div style={{padding:"14px 20px",borderBottom:"1px solid var(--bdr)",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:"var(--card)",zIndex:1}}>
        <span style={{fontSize:14,fontWeight:800,color:"var(--txt)"}}>{title}</span>
        <button onClick={onClose} style={{background:"none",border:"none",color:"var(--txt2)",cursor:"pointer",fontSize:20,padding:"0 6px",lineHeight:1}}>×</button>
      </div>
      <div style={{padding:20}}>{children}</div>
    </div>
  </div>
);
const Toast=({msg,color})=>msg?<div style={{position:"fixed",bottom:24,right:24,background:color||"var(--green)",color:"#fff",padding:"10px 18px",borderRadius:8,fontWeight:700,fontSize:12,zIndex:9999,animation:"fadeUp .2s ease",boxShadow:"var(--shadow)"}}>{msg}</div>:null;

/* ─── THEME TOGGLE ─────────────────────────────────────────────*/
const ThemeToggle=({isDark,toggle})=>(
  <button onClick={toggle} style={{background:"var(--s2)",border:"1px solid var(--bdr)",borderRadius:20,padding:"4px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontSize:11,color:"var(--txt2)",transition:"all .2s"}}>
    <span style={{fontSize:14}}>{isDark?"☀":"🌙"}</span>
    <span style={{fontFamily:"IBM Plex Mono",fontWeight:600}}>{isDark?"Light":"Dark"}</span>
  </button>
);

/* ─── ADD RESOURCE MODAL ───────────────────────────────────────*/
const AddResourceModal=({onClose,onAdd,allProjects,existingUsers})=>{
  const [form,setForm]=useState({name:"",email:"",resourceRole:"jr_hw",loginType:"developer",projects:[],dept:"",avatar:""});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const roleMap={superadmin:"Super Admin",pm:"Project Manager",developer:"Developer"};
  const loginTypeToRole={superadmin:"superadmin",pm:"pm",developer:"developer"};
  const toggleProj=(id)=>setForm(f=>({...f,projects:f.projects.includes(id)?f.projects.filter(x=>x!==id):[...f.projects,id]}));
  const save=()=>{
    if(!form.name||!form.email)return alert("Name and email required");
    if(existingUsers.find(u=>u.email===form.email))return alert("Email already exists");
    const ri=RESOURCE_ROLES.find(r=>r.key===form.resourceRole);
    const newUser={id:mkUID(),name:form.name,email:form.email,role:loginTypeToRole[form.loginType],avatar:initials(form.name),dept:form.dept||ri?.label||"",resourceRole:form.resourceRole,loginType:form.loginType};
    onAdd(newUser,form.projects,"dev123");
    onClose();
  };
  return(
    <Modal title="Add New Resource" onClose={onClose} maxW={580}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 14px"}}>
          <div style={{gridColumn:"span 2"}}><Lbl>Full Name</Lbl><Inp value={form.name} onChange={e=>{set("name",e.target.value);if(!form.avatar)set("avatar",initials(e.target.value));}} placeholder="e.g. Raj Patel"/></div>
          <div><Lbl>Email</Lbl><Inp type="email" value={form.email} onChange={e=>set("email",e.target.value)} placeholder="raj@elecbits.in"/></div>
          <div><Lbl>Department</Lbl><Inp value={form.dept} onChange={e=>set("dept",e.target.value)} placeholder="e.g. Hardware"/></div>
          <div>
            <Lbl>Role / Function</Lbl>
            <Sel value={form.resourceRole} onChange={e=>set("resourceRole",e.target.value)}>
              {["senior","junior","shared"].map(tier=>(
                <optgroup key={tier} label={tier.charAt(0).toUpperCase()+tier.slice(1)+" Resources"}>
                  {RESOURCE_ROLES.filter(r=>r.tier===tier).map(r=><option key={r.key} value={r.key}>{r.label}</option>)}
                </optgroup>
              ))}
            </Sel>
          </div>
          <div>
            <Lbl>Login Type</Lbl>
            <Sel value={form.loginType} onChange={e=>set("loginType",e.target.value)}>
              <option value="superadmin">Super Admin</option>
              <option value="pm">Project Manager</option>
              <option value="developer">Developer</option>
            </Sel>
          </div>
        </div>
        <div>
          <Lbl>Assign to Projects</Lbl>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:4}}>
            {allProjects.map(p=>(
              <label key={p.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:"var(--s2)",borderRadius:7,cursor:"pointer",border:`1px solid ${form.projects.includes(p.id)?"var(--acc)":"var(--bdr)"}`}}>
                <input type="checkbox" checked={form.projects.includes(p.id)} onChange={()=>toggleProj(p.id)} style={{flexShrink:0}}/>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:"var(--txt)"}}>{p.name}</div>
                  <div style={{fontSize:10,color:"var(--txt2)",fontFamily:"IBM Plex Mono"}}>{p.startDate} → {p.endDate}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
        <div style={{padding:"10px 14px",background:"var(--s2)",borderRadius:7,display:"flex",gap:8,alignItems:"center"}}>
          <div style={{width:36,height:36,borderRadius:"50%",background:`${avColors[(mkUID()-1)%avColors.length]}22`,border:`1.5px solid ${avColors[(mkUID()-1)%avColors.length]}60`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:avColors[(mkUID()-1)%avColors.length],fontFamily:"IBM Plex Mono"}}>{initials(form.name)||"?"}</div>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:"var(--txt)"}}>{form.name||"New Resource"}</div>
            <div style={{fontSize:10,color:"var(--txt2)"}}>{RESOURCE_ROLES.find(r=>r.key===form.resourceRole)?.label} · {form.loginType} · Default pw: dev123</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Btn v="secondary" onClick={onClose}>Cancel</Btn>
          <Btn v="success" onClick={save}>✓ Add Resource</Btn>
        </div>
      </div>
    </Modal>
  );
};

/* ─── GANTT ─────────────────────────────────────────────────── */
const GanttView=({project,users})=>{
  const start=new Date(project.startDate),end=new Date(project.endDate||"2025-12-31");
  const total=Math.max(1,(end-start)/86400000);
  const todayPct=Math.min(100,Math.max(0,((new Date()-start)/86400000/total)*100));
  const phases=[{label:"HW Design",color:"var(--amber)",s:0,l:35},{label:"HW Testing",color:"var(--amber)",s:30,l:20},{label:"FW Logic",color:"var(--blue)",s:25,l:40},{label:"FW Testing",color:"var(--blue)",s:60,l:20},{label:"Ind. Design",color:"var(--green)",s:10,l:40},{label:"ID Testing",color:"var(--green)",s:45,l:20},{label:"Supply Chain",color:"var(--purple)",s:20,l:50},{label:"Testing",color:"var(--red)",s:75,l:20},{label:"Production",color:"var(--coral)",s:90,l:10}];
  const months=[];const s2=new Date(start);s2.setDate(1);while(s2<=end){months.push({label:s2.toLocaleDateString("en-IN",{month:"short"}),pct:Math.max(0,Math.min(97,((s2-start)/86400000/total)*100))});s2.setMonth(s2.getMonth()+1);}
  return(
    <div style={{background:"var(--s2)",borderRadius:10,padding:18}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--txt3)",fontFamily:"IBM Plex Mono",marginBottom:8}}><span>{fmtDate(project.startDate)}</span><span>{fmtDate(project.endDate)}</span></div>
      <div style={{position:"relative",height:16,marginBottom:8}}>{months.map((m,i)=><span key={i} style={{position:"absolute",left:`${m.pct}%`,fontSize:9,color:"var(--txt3)",fontFamily:"IBM Plex Mono",transform:"translateX(-50%)"}}>{m.label}</span>)}<span style={{position:"absolute",left:`${todayPct}%`,fontSize:8,color:"var(--red)",fontFamily:"IBM Plex Mono",transform:"translateX(-50%)",bottom:-2}}>▼</span></div>
      {phases.map((ph,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}><div style={{width:110,flexShrink:0,fontSize:10,color:"var(--txt2)",textAlign:"right"}}>{ph.label}</div><div style={{flex:1,position:"relative",height:12}}><div style={{position:"absolute",inset:0,background:"var(--bdr)",borderRadius:3}}/><div style={{position:"absolute",left:`${ph.s}%`,width:`${ph.l}%`,height:"100%",background:ph.color,borderRadius:3,opacity:.8}}/><div style={{position:"absolute",left:`${todayPct}%`,top:-2,bottom:-2,width:1.5,background:"var(--red)",opacity:.9}}/></div></div>)}
      <Divider/>
      <div style={{fontSize:10,color:"var(--txt3)",fontFamily:"IBM Plex Mono",marginBottom:6,fontWeight:700}}>TEAM TIMELINE</div>
      {(project.teamAssignments||[]).map((a,i)=>{const u=getUser(a.userId,users||INIT_USERS);if(!u)return null;const aS=new Date(a.startDate),aE=new Date(a.endDate||project.endDate);const sPct=Math.max(0,((aS-start)/86400000/total)*100),len=Math.max(1,((aE-aS)/86400000/total)*100);return(<div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}><div style={{width:110,flexShrink:0,display:"flex",alignItems:"center",gap:5}}><Av uid={u.id} size={14} users={users}/><span style={{fontSize:10,color:"var(--txt2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.name}</span></div><div style={{flex:1,position:"relative",height:12}}><div style={{position:"absolute",inset:0,background:"var(--bdr)",borderRadius:3}}/><div style={{position:"absolute",left:`${sPct}%`,width:`${len}%`,height:"100%",background:"var(--acc)",borderRadius:3,opacity:.7}}/><div style={{position:"absolute",left:`${todayPct}%`,top:-2,bottom:-2,width:1.5,background:"var(--red)",opacity:.9}}/></div><span style={{fontSize:9,color:"var(--txt3)",fontFamily:"IBM Plex Mono",width:50,textAlign:"right",flexShrink:0}}>{a.role}</span></div>);})}
    </div>
  );
};

/* ─── CHECKLIST PAGE ───────────────────────────────────────────*/
const ChecklistPage=({def,instance,onBack,onSave,currentUser,isGantt,project,users})=>{
  const canEdit=canEditCL(currentUser,def.key);
  const initItems=()=>{if(instance?.items?.length)return instance.items.map(it=>({tmApproval:"Pending",pmApproval:"Pending",clientApproval:"Pending",...it}));const defs=def.key==="production"?genProdItems(instance?.units||100):DEFAULT_ITEMS[def.key]||[];return defs.map((t,i)=>mkItem(t,i));};
  const [items,setItems]=useState(initItems);
  const [note,setNote]=useState(instance?.note||"");
  const [excelName,setExcelName]=useState(instance?.excelFile||"");
  const [auditStatus,setAuditStatus]=useState(instance?.auditStatus||"Not Reviewed");
  const [expanded,setExpanded]=useState(null);
  const fileRef=useRef();const taskFileRefs=useRef({});
  const done=items.filter(x=>x.done).length,pct=Math.round((done/Math.max(1,items.length))*100);
  const upd=(id,f,v)=>setItems(prev=>prev.map(x=>x.id===id?{...x,[f]:v,lastUpdated:todayStr()}:x));
  const addItem=()=>setItems(prev=>[...prev,mkItem("New item",Date.now())]);
  const remove=(id)=>setItems(prev=>prev.filter(x=>x.id!==id));
  const addComment=(id,text)=>{if(!text)return;setItems(prev=>prev.map(x=>x.id===id?{...x,comments:[...(x.comments||[]),{id:UNIQ(),text,time:new Date().toLocaleString()}]}:x));};
  const addRoadblock=(id,text)=>{if(!text)return;setItems(prev=>prev.map(x=>x.id===id?{...x,roadblocks:[...(x.roadblocks||[]),{id:UNIQ(),text,time:new Date().toLocaleString(),resolved:false}]}:x));};
  const toggleRB=(iid,rid)=>setItems(prev=>prev.map(x=>x.id===iid?{...x,roadblocks:(x.roadblocks||[]).map(r=>r.id===rid?{...r,resolved:!r.resolved}:r)}:x));
  const addFile=(id,fname)=>setItems(prev=>prev.map(x=>x.id===id?{...x,files:[...(x.files||[]),{name:fname,time:todayStr()}]}:x));
  const removeFile=(id,fname)=>setItems(prev=>prev.map(x=>x.id===id?{...x,files:(x.files||[]).filter(f=>f.name!==fname)}:x));
  const handleExcel=(e)=>{const f=e.target.files[0];if(!f)return;setExcelName(f.name);const rows=["Imported: "+f.name+" row 1","Imported: "+f.name+" row 2","Imported: "+f.name+" row 3"];setItems(prev=>[...prev,...rows.map((t,i)=>mkItem(t,Date.now()+i))]);};
  const auditC={"Not Reviewed":"var(--txt3)",Approved:"var(--green)",Rejected:"var(--red)","In Review":"var(--amber)"};
  const ST=["Pending","In Progress","Done","Blocked","On Hold"];
  const AP3=["Pending","Approved","Rejected","On Hold"];
  const AP3C={Approved:"var(--green)",Rejected:"var(--red)","On Hold":"var(--amber)",Pending:"var(--txt3)"};

  const ExpandPanel=({item})=>{
    const [c,setC]=useState("");const [rb,setRb]=useState("");
    return(
      <tr style={{background:"var(--bg)"}}>
        <td colSpan={9} style={{padding:0}}>
          <div style={{padding:"14px 16px",display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,borderBottom:`2px solid var(--bdr2)`}}>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:"var(--blue)",fontFamily:"IBM Plex Mono",marginBottom:8,textTransform:"uppercase"}}>💬 Comments</div>
              {(item.comments||[]).map(cm=><div key={cm.id} style={{padding:"7px 10px",background:"var(--s2)",borderRadius:6,marginBottom:5,borderLeft:"2px solid var(--blue)"}}><div style={{fontSize:11,marginBottom:2}}>{cm.text}</div><div style={{fontSize:9,color:"var(--txt3)",fontFamily:"IBM Plex Mono"}}>{cm.time}</div></div>)}
              {!(item.comments||[]).length&&<div style={{fontSize:11,color:"var(--txt3)",marginBottom:6}}>No comments yet</div>}
              {canEdit&&<div style={{display:"flex",gap:5}}><input value={c} onChange={e=>setC(e.target.value)} placeholder="Add comment…" className="inp-base" style={{flex:1,fontSize:11,padding:"5px 8px"}} onKeyDown={e=>{if(e.key==="Enter"&&c){addComment(item.id,c);setC("");}}}/><Btn v="ghost" style={{fontSize:10,padding:"4px 8px"}} onClick={()=>{addComment(item.id,c);setC("");}}>+</Btn></div>}
            </div>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:"var(--red)",fontFamily:"IBM Plex Mono",marginBottom:8,textTransform:"uppercase"}}>⚠ Roadblocks</div>
              {(item.roadblocks||[]).map(r=><div key={r.id} style={{padding:"7px 10px",background:r.resolved?"var(--s2)":"var(--red)08",borderRadius:6,marginBottom:5,borderLeft:`2px solid ${r.resolved?"var(--txt3)":"var(--red)"}`,display:"flex",gap:8}}><input type="checkbox" checked={r.resolved} onChange={()=>toggleRB(item.id,r.id)} style={{marginTop:2,flexShrink:0}}/><div style={{flex:1}}><div style={{fontSize:11,textDecoration:r.resolved?"line-through":"none",color:r.resolved?"var(--txt3)":"var(--txt)"}}>{r.text}</div><div style={{fontSize:9,color:"var(--txt3)",fontFamily:"IBM Plex Mono"}}>{r.time}</div></div></div>)}
              {!(item.roadblocks||[]).length&&<div style={{fontSize:11,color:"var(--txt3)",marginBottom:6}}>No roadblocks</div>}
              {canEdit&&<div style={{display:"flex",gap:5}}><input value={rb} onChange={e=>setRb(e.target.value)} placeholder="Log roadblock…" className="inp-base" style={{flex:1,fontSize:11,padding:"5px 8px",borderColor:"var(--red)50"}} onKeyDown={e=>{if(e.key==="Enter"&&rb){addRoadblock(item.id,rb);setRb("");}}}/><Btn v="danger" style={{fontSize:10,padding:"4px 8px"}} onClick={()=>{addRoadblock(item.id,rb);setRb("");}}>+</Btn></div>}
            </div>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:"var(--green)",fontFamily:"IBM Plex Mono",marginBottom:8,textTransform:"uppercase"}}>📎 Files</div>
              {(item.files||[]).map(f=><div key={f.name} style={{display:"flex",justifyContent:"space-between",padding:"6px 8px",background:"var(--s2)",borderRadius:5,marginBottom:5,borderLeft:"2px solid var(--green)"}}><span style={{fontSize:11,color:"var(--green)"}}>{f.name}</span><div style={{display:"flex",gap:6,alignItems:"center"}}><span style={{fontSize:9,color:"var(--txt3)",fontFamily:"IBM Plex Mono"}}>{f.time}</span>{canEdit&&<button onClick={()=>removeFile(item.id,f.name)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--txt3)",fontSize:13}}>×</button>}</div></div>)}
              {canEdit&&<><input type="file" style={{display:"none"}} ref={el=>taskFileRefs.current[item.id]=el} onChange={e=>{if(e.target.files[0])addFile(item.id,e.target.files[0].name);}}/><Btn v="ghost" style={{fontSize:10,padding:"4px 10px",width:"100%",justifyContent:"center"}} onClick={()=>taskFileRefs.current[item.id]?.click()}>+ Add File</Btn></>}
            </div>
          </div>
        </td>
      </tr>
    );
  };

  return(
    <div style={{flex:1,overflow:"auto",display:"flex",flexDirection:"column"}}>
      <div style={{background:"var(--s1)",borderBottom:"1px solid var(--bdr)",padding:"10px 22px",display:"flex",alignItems:"center",gap:10,flexShrink:0,flexWrap:"wrap"}}>
        <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",color:"var(--txt2)",fontSize:17,padding:0}}>←</button>
        <span style={{color:"var(--txt3)",fontSize:12}}>{project.name} /</span>
        <span style={{fontWeight:700,fontSize:13,color:"var(--txt)"}}>{def.icon} {def.label}</span>
        {instance?.units&&<Tag label={`${instance.units} units`} color="var(--purple)"/>}
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:10,color:"var(--txt2)",fontFamily:"IBM Plex Mono"}}>AUDIT:</span>
          {canEdit?<Sel value={auditStatus} onChange={e=>setAuditStatus(e.target.value)} style={{width:130,padding:"4px 8px",fontSize:10,color:auditC[auditStatus]}}>
            {["Not Reviewed","In Review","Approved","Rejected"].map(o=><option key={o}>{o}</option>)}
          </Sel>:<Tag label={auditStatus} color={auditC[auditStatus]}/>}
          <div style={{width:90}}><Bar val={pct} color={def.color} thin/></div>
          <span style={{fontSize:11,fontWeight:700,color:def.color,fontFamily:"IBM Plex Mono"}}>{done}/{items.length}</span>
          {canEdit&&<Btn v="success" style={{padding:"5px 12px",fontSize:11}} onClick={()=>onSave({items,note,excelFile:excelName,auditStatus})}>Save</Btn>}
        </div>
      </div>
      <div style={{flex:1,overflow:"auto",padding:18}}>
        {isGantt?<GanttView project={project} users={users}/>:(
          <>
            <Card style={{padding:12,marginBottom:12,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <div style={{flex:1}}><Lbl style={{marginBottom:2}}>Source Document (LLD / Client Communication)</Lbl><div style={{fontSize:11,color:excelName?"var(--green)":"var(--txt3)"}}>{excelName||"No file attached — upload Excel/CSV to import tasks"}</div></div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}} onChange={handleExcel}/>
              {canEdit&&<Btn v="secondary" style={{fontSize:11,padding:"5px 10px"}} onClick={()=>fileRef.current?.click()}>📎 Add Excel / CSV</Btn>}
            </Card>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <div style={{flex:1,height:7,background:"var(--bdr)",borderRadius:99,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:def.color,borderRadius:99}}/></div>
              <span style={{fontSize:12,fontWeight:800,color:def.color,fontFamily:"IBM Plex Mono"}}>{pct}%</span>
              {canEdit&&<Btn v="ghost" style={{fontSize:11,padding:"4px 10px"}} onClick={addItem}>+ Item</Btn>}
            </div>
            <div style={{overflow:"auto",border:"1px solid var(--bdr)",borderRadius:8}}>
              {!canEdit&&<div style={{padding:"8px 14px",background:"var(--amber)10",border:"1px solid var(--amber)25",borderRadius:"8px 8px 0 0",fontSize:11,color:"var(--amber)",fontFamily:"IBM Plex Mono",fontWeight:700}}>👁 VIEW ONLY — This checklist is owned by {RESOURCE_ROLES.find(r=>CL_OWNERS[def.key]?.includes(r.key))?.label||"domain team"}</div>}
              <table>
                <thead><tr>
                  <th style={{width:30}}>#</th>
                  <th>Task</th>
                  <th style={{width:95}}>Status</th>
                  <th style={{width:85,textAlign:"center",background:"var(--amber)10",color:"var(--amber)"}}>TM Approval</th>
                  <th style={{width:85,textAlign:"center",background:"var(--blue)10",color:"var(--blue)"}}>PM Approval</th>
                  <th style={{width:85,textAlign:"center",background:"var(--green)10",color:"var(--green)"}}>Client Approval</th>
                  <th style={{width:110}}>Link</th>
                  <th style={{width:130}}>Remarks</th>
                  <th style={{width:85}}>Updated</th>
                  <th style={{width:55}}>Details</th>
                  <th style={{width:28}}/>
                </tr></thead>
                <tbody>
                  {items.map(item=>(
                    <>
                      <tr key={item.id} style={{background:item.done?"var(--green)06":"",cursor:"pointer"}} onClick={()=>setExpanded(expanded===item.id?null:item.id)}>
                        <td style={{textAlign:"center"}} onClick={e=>{e.stopPropagation();upd(item.id,"done",!item.done);}}><input type="checkbox" checked={item.done} onChange={()=>{}} disabled={!canEdit}/></td>
                        <td onClick={e=>e.stopPropagation()}>{canEdit?<input value={item.text} onChange={e=>upd(item.id,"text",e.target.value)} style={{background:"transparent",border:"none",color:item.done?"var(--txt3)":"var(--txt)",fontSize:12,outline:"none",width:"100%",textDecoration:item.done?"line-through":"none"}}/>:<span style={{fontSize:12,color:item.done?"var(--txt3)":"var(--txt)",textDecoration:item.done?"line-through":"none"}}>{item.text}</span>}</td>
                        <td onClick={e=>e.stopPropagation()}>{canEdit?<select value={item.status} onChange={e=>upd(item.id,"status",e.target.value)} style={{background:"transparent",border:"none",color:{Done:"var(--green)",Blocked:"var(--red)","In Progress":"var(--blue)","On Hold":"var(--amber)",Pending:"var(--txt2)"}[item.status],fontSize:11,outline:"none",cursor:"pointer",fontWeight:700,fontFamily:"IBM Plex Mono",width:"100%"}}>{ST.map(o=><option key={o}>{o}</option>)}</select>:<Tag label={item.status} color={{Done:"var(--green)",Blocked:"var(--red)","In Progress":"var(--blue)","On Hold":"var(--amber)"}[item.status]}/>}</td>
                        {/* TM Approval */}
                        <td style={{textAlign:"center",background:"var(--amber)05"}} onClick={e=>e.stopPropagation()}>
                          {canEdit?<select value={item.tmApproval||"Pending"} onChange={e=>upd(item.id,"tmApproval",e.target.value)} style={{background:"transparent",border:"none",color:AP3C[item.tmApproval||"Pending"],fontSize:10,outline:"none",cursor:"pointer",fontWeight:700,fontFamily:"IBM Plex Mono",width:"100%"}}>{AP3.map(o=><option key={o}>{o}</option>)}</select>:<Tag label={item.tmApproval||"Pending"} color={AP3C[item.tmApproval||"Pending"]}/>}
                        </td>
                        {/* PM Approval */}
                        <td style={{textAlign:"center",background:"var(--blue)05"}} onClick={e=>e.stopPropagation()}>
                          {(currentUser.role==="pm"||currentUser.role==="superadmin")?<select value={item.pmApproval||"Pending"} onChange={e=>upd(item.id,"pmApproval",e.target.value)} style={{background:"transparent",border:"none",color:AP3C[item.pmApproval||"Pending"],fontSize:10,outline:"none",cursor:"pointer",fontWeight:700,fontFamily:"IBM Plex Mono",width:"100%"}}>{AP3.map(o=><option key={o}>{o}</option>)}</select>:<Tag label={item.pmApproval||"Pending"} color={AP3C[item.pmApproval||"Pending"]}/>}
                        </td>
                        {/* Client Approval — admin/PM only */}
                        <td style={{textAlign:"center",background:"var(--green)05"}} onClick={e=>e.stopPropagation()}>
                          {(currentUser.role==="superadmin"||currentUser.role==="pm")?<select value={item.clientApproval||"Pending"} onChange={e=>upd(item.id,"clientApproval",e.target.value)} style={{background:"transparent",border:"none",color:AP3C[item.clientApproval||"Pending"],fontSize:10,outline:"none",cursor:"pointer",fontWeight:700,fontFamily:"IBM Plex Mono",width:"100%"}}>{AP3.map(o=><option key={o}>{o}</option>)}</select>:<Tag label={item.clientApproval||"Pending"} color={AP3C[item.clientApproval||"Pending"]}/>}
                        </td>
                        <td onClick={e=>e.stopPropagation()}>{canEdit?<input value={item.link} onChange={e=>upd(item.id,"link",e.target.value)} placeholder="https://…" style={{background:"transparent",border:"none",color:"var(--acc)",fontSize:11,outline:"none",width:"100%"}}/>:item.link?<a href={item.link} style={{color:"var(--acc)",fontSize:11}} target="_blank" rel="noreferrer">🔗 Link</a>:<span style={{fontSize:11,color:"var(--txt3)"}}>—</span>}</td>
                        <td onClick={e=>e.stopPropagation()}>{canEdit?<input value={item.remarks} onChange={e=>upd(item.id,"remarks",e.target.value)} placeholder="Notes…" style={{background:"transparent",border:"none",color:"var(--txt2)",fontSize:11,outline:"none",width:"100%"}}/>:<span style={{fontSize:11,color:"var(--txt2)"}}>{item.remarks||"—"}</span>}</td>
                        <td style={{fontSize:10,color:"var(--txt3)",fontFamily:"IBM Plex Mono"}}>{item.lastUpdated}</td>
                        <td style={{textAlign:"center"}}><div style={{display:"flex",gap:3,alignItems:"center",justifyContent:"center"}}>{(item.comments||[]).length>0&&<span style={{fontSize:9,color:"var(--blue)",fontFamily:"IBM Plex Mono"}}>💬{item.comments.length}</span>}{(item.roadblocks||[]).filter(r=>!r.resolved).length>0&&<span style={{fontSize:9,color:"var(--red)",fontFamily:"IBM Plex Mono"}}>⚠{item.roadblocks.filter(r=>!r.resolved).length}</span>}{(item.files||[]).length>0&&<span style={{fontSize:9,color:"var(--green)",fontFamily:"IBM Plex Mono"}}>📎{item.files.length}</span>}<span style={{fontSize:11,color:"var(--txt3)"}}>{expanded===item.id?"▲":"▼"}</span></div></td>
                        <td>{canEdit&&<button onClick={e=>{e.stopPropagation();remove(item.id);}} style={{background:"none",border:"none",cursor:"pointer",color:"var(--txt3)",fontSize:14}}>×</button>}</td>
                      </tr>
                      {expanded===item.id&&<ExpandPanel item={item}/>}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{marginTop:12}}><Lbl>Notes</Lbl><TA value={note} onChange={e=>setNote(e.target.value)} rows={2} disabled={!canEdit} style={{fontSize:11}}/></div>
          </>
        )}
      </div>
    </div>
  );
};

/* ─── PRODUCTION MODAL ─────────────────────────────────────────*/
const ProdModal=({onClose,onAdd})=>{
  const [units,setUnits]=useState(100);const [label,setLabel]=useState("");
  return(
    <Modal title="New Production Checklist" onClose={onClose} maxW={460}>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><Lbl>Units Required</Lbl><Inp type="number" min="1" value={units} onChange={e=>setUnits(Number(e.target.value))}/></div>
          <div><Lbl>Batch Label</Lbl><Inp value={label} onChange={e=>setLabel(e.target.value)} placeholder="e.g. Pilot Run 1"/></div>
        </div>
        <div style={{background:"var(--s2)",borderRadius:8,padding:12}}>
          <Lbl>Auto-generated ({genProdItems(units).length} items)</Lbl>
          {genProdItems(units).slice(0,4).map((it,i)=><div key={i} style={{fontSize:11,color:"var(--txt2)",padding:"2px 0",borderBottom:"1px solid var(--bdr)"}}>{i+1}. {it}</div>)}
          <div style={{fontSize:11,color:"var(--txt3)",marginTop:5}}>...and {genProdItems(units).length-4} more</div>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8}}><Btn v="secondary" onClick={onClose}>Cancel</Btn><Btn v="success" onClick={()=>{onAdd({units,label:label||`Production — ${units} units`,items:genProdItems(units).map((t,i)=>mkItem(t,i)),note:"",excelFile:"",auditStatus:"Not Reviewed"});onClose();}}>🏭 Create</Btn></div>
      </div>
    </Modal>
  );
};

/* ─── PROJECT PAGE ─────────────────────────────────────────────*/
const ProjectPage=({project,currentUser,onBack,onUpdateProject,allProjects,setProjects,users})=>{
  const [tab,setTab]=useState("details");
  const [openCL,setOpenCL]=useState(null);
  const [showProd,setShowProd]=useState(false);
  const [editTeam,setEditTeam]=useState(false);
  const [editDesc,setEditDesc]=useState(false);
  const [desc,setDesc]=useState(project.description||"");
  const [showReminder,setShowReminder]=useState(false);
  const [toast,setToast]=useState(null);
  const isAdmin=currentUser.role==="superadmin";
  const isPM=currentUser.role==="pm"||isAdmin;
  const showToast=(msg,color)=>{setToast({msg,color});setTimeout(()=>setToast(null),2600);};
  const upd=(updated)=>onUpdateProject(updated);

  const saveCL=(def,idx,data)=>{const cl={...(project.checklists||{})};if(def.multi){const arr=[...(cl.production||[])];arr[idx]={...arr[idx],...data};cl.production=arr;}else cl[def.key]={...(cl[def.key]||{}),...data};upd({...project,checklists:cl});showToast("Saved ✓","var(--green)");};
  const addProdCL=(data)=>{const cl={...(project.checklists||{})};cl.production=[...(cl.production||[]),data];upd({...project,checklists:cl});showToast("Created 🏭","var(--amber)");};

  if(openCL){const def=CHECKLIST_DEFS.find(d=>d.key===openCL.def);const instance=def.multi?(project.checklists?.production||[])[openCL.idx]:(project.checklists?.[def.key]||{});return <ChecklistPage def={def} instance={instance} isGantt={def.key==="gantt"} project={project} currentUser={currentUser} users={users} onBack={()=>setOpenCL(null)} onSave={(data)=>saveCL(def,def.multi?openCL.idx:null,data)}/>;}

  const dl=daysLeft(project.endDate);
  const auditC={"Not Reviewed":"var(--txt3)",Approved:"var(--green)",Rejected:"var(--red)","In Review":"var(--amber)"};

  const TeamEditor=()=>{
    const [a,setA]=useState(project.teamAssignments||[]);
    const addR=()=>setA(prev=>[...prev,{userId:nonAdmins(users)[0]?.id,role:"Member",startDate:project.startDate||todayStr(),endDate:project.endDate||""}]);
    const updR=(i,k,v)=>setA(prev=>prev.map((x,idx)=>idx===i?{...x,[k]:v}:x));
    const delR=(i)=>setA(prev=>prev.filter((_,idx)=>idx!==i));
    const avail=nonAdmins(users).filter(u=>{const ac=activeProjs(u.id,allProjects).filter(p=>p.id!==project.id).length;return ac<userCap(u);});
    const conflicts=[];a.forEach((x,i)=>{activeProjs(x.userId,allProjects).filter(p=>p.id!==project.id).forEach(p=>{const oa=p.teamAssignments?.find(q=>q.userId===x.userId);if(oa&&x.startDate&&x.endDate&&!(oa.endDate<x.startDate||x.endDate<oa.startDate))conflicts.push({i,name:getUser(x.userId,users)?.name,proj:p.name});});});
    // auto-fill role from designation when user changes
    const autoRole=(userId)=>{const u=getUser(userId,users);const ri=RESOURCE_ROLES.find(r=>r.key===u?.resourceRole);return ri?.label||u?.dept||"Member";};
    return(
      <Card style={{padding:16}}>
        {conflicts.length>0&&<div style={{marginBottom:10,padding:"8px 12px",background:"var(--red)10",border:"1px solid var(--red)30",borderRadius:6}}><div style={{fontSize:10,color:"var(--red)",fontWeight:700,fontFamily:"IBM Plex Mono",marginBottom:3}}>⚠ SCHEDULING CONFLICTS</div>{conflicts.map((c,i)=><div key={i} style={{fontSize:11,color:"var(--amber)"}}>{c.name} already on {c.proj}</div>)}</div>}
        <div style={{fontSize:10,color:"var(--green)",fontFamily:"IBM Plex Mono",marginBottom:8}}>✓ within capacity  ⚠ at/over capacity · Designation auto-filled from resource profile</div>
        {a.map((x,i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 110px 90px 90px 24px",gap:6,marginBottom:6,alignItems:"center"}}>
            <Sel value={x.userId} onChange={e=>{const uid=Number(e.target.value);updR(i,"userId",uid);updR(i,"role",autoRole(uid));}} style={{padding:"5px 8px",fontSize:11}}>
              {nonAdmins(users).map(u=>{
                const ri=RESOURCE_ROLES.find(r=>r.key===u.resourceRole);
                const ok=avail.find(av=>av.id===u.id)||u.id===x.userId;
                return <option key={u.id} value={u.id}>{ok?"✓":"⚠"} {u.name} — {ri?.label||u.dept}</option>;
              })}
            </Sel>
            <Inp value={x.role} onChange={e=>updR(i,"role",e.target.value)} style={{padding:"5px 8px",fontSize:11}} placeholder="Role"/>
            <Inp type="date" value={x.startDate} onChange={e=>updR(i,"startDate",e.target.value)} style={{padding:"5px 8px",fontSize:11}}/>
            <Inp type="date" value={x.endDate} onChange={e=>updR(i,"endDate",e.target.value)} style={{padding:"5px 8px",fontSize:11}}/>
            <button onClick={()=>delR(i)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--red)",fontSize:15,padding:0}}>×</button>
          </div>
        ))}
        <div style={{display:"flex",gap:8,marginTop:8}}><Btn v="ghost" style={{fontSize:11,padding:"4px 10px"}} onClick={addR}>+ Add</Btn><Btn v="secondary" style={{flex:1,justifyContent:"center",fontSize:11}} onClick={()=>setEditTeam(false)}>Cancel</Btn><Btn style={{flex:1,justifyContent:"center",fontSize:11}} onClick={()=>{upd({...project,teamAssignments:a});setEditTeam(false);showToast("Team saved ✓","var(--green)");}}>Save</Btn></div>
      </Card>
    );
  };

  const CommSection=()=>{
    const [showAdd,setShowAdd]=useState(false);const [type,setType]=useState("minor");const [subject,setSubject]=useState("");const [body,setBody]=useState("");const [ecn,setEcn]=useState("");
    const submit=()=>{if(!subject||!body)return alert("Fill all fields");upd({...project,communications:[...(project.communications||[]),{id:UNIQ(),type,subject,body,ecnNum:ecn,author:currentUser.id,timestamp:new Date().toLocaleString(),status:type==="major"?"pending_approval":"active"}]});setShowAdd(false);setSubject("");setBody("");setEcn("");};
    return(
      <div>
        <SH title="Client Communication" color="var(--purple)" action={isPM&&<div style={{display:"flex",gap:6}}><Btn v="ghost" style={{fontSize:10,padding:"4px 10px"}} onClick={()=>setShowReminder(true)}>📨</Btn><Btn v="ghost" style={{fontSize:10,padding:"4px 10px"}} onClick={()=>setShowAdd(true)}>+ Add</Btn></div>}/>
        {(project.communications||[]).map(c=>(
          <Card key={c.id} style={{padding:12,marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,flexWrap:"wrap",gap:4}}><div style={{display:"flex",gap:6}}><Pill label={c.type==="minor"?"Minor Change":"Major Change"} color={c.type==="minor"?"var(--blue)":"var(--red)"} small/>{c.status==="pending_approval"&&<Pill label="Awaiting Approval" color="var(--amber)" small/>}{c.status==="approved"&&<Pill label="Approved" color="var(--green)" small/>}{c.ecnNum&&<Tag label={`ECN: ${c.ecnNum}`} color="var(--blue)"/>}</div><span style={{fontSize:10,color:"var(--txt3)",fontFamily:"IBM Plex Mono"}}>{c.timestamp}</span></div>
            <div style={{fontWeight:700,fontSize:12,marginBottom:3,color:"var(--txt)"}}>{c.subject}</div>
            <div style={{fontSize:12,color:"var(--txt2)"}}>{c.body}</div>
            {c.type==="major"&&c.status==="pending_approval"&&isAdmin&&<div style={{display:"flex",gap:6,marginTop:8}}><Btn v="success" style={{fontSize:10,padding:"4px 10px"}} onClick={()=>{const comms=(project.communications||[]).map(x=>x.id===c.id?{...x,status:"approved"}:x);const np={id:Date.now(),name:project.name+" (v2)",projectId:"EB-NEW",productId:"PD-NEW",projectTag:project.projectTag,description:"From major change: "+c.subject,startDate:todayStr(),endDate:"",rag:"amber",sanctioned:false,teamAssignments:[],checklists:{},communications:[],reminders:[]};setProjects(ps=>[...ps,np]);upd({...project,communications:comms});showToast("Approved ✓","var(--green)");}}>✓ Approve</Btn><Btn v="danger" style={{fontSize:10,padding:"4px 10px"}} onClick={()=>upd({...project,communications:(project.communications||[]).map(x=>x.id===c.id?{...x,status:"rejected"}:x)})}>✗ Reject</Btn></div>}
          </Card>
        ))}
        {!(project.communications||[]).length&&!showAdd&&<div style={{textAlign:"center",padding:"20px 0",color:"var(--txt3)",fontSize:12}}>No communications logged.</div>}
        {showAdd&&<Card style={{padding:14,border:"1px solid var(--bdr2)"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <div><Lbl>Change Type</Lbl><Sel value={type} onChange={e=>setType(e.target.value)}><option value="minor">Minor Change (ECN)</option><option value="major">Major Change</option></Sel></div>
            {type==="minor"&&<div><Lbl>ECN Number</Lbl><Inp value={ecn} onChange={e=>setEcn(e.target.value)} placeholder="ECN-2025-001"/></div>}
          </div>
          <div style={{marginBottom:10}}><Lbl>Subject</Lbl><Inp value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Brief description"/></div>
          <div style={{marginBottom:10}}><Lbl>Details</Lbl><TA value={body} onChange={e=>setBody(e.target.value)} rows={3}/></div>
          <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}><Btn v="secondary" onClick={()=>setShowAdd(false)}>Cancel</Btn><Btn v={type==="minor"?"primary":"amber"} onClick={submit}>{type==="minor"?"📋 Log":"⚠ Request"}</Btn></div>
        </Card>}
      </div>
    );
  };

  return(
    <div style={{flex:1,overflow:"auto",display:"flex",flexDirection:"column"}}>
      <div style={{background:"var(--s1)",borderBottom:"1px solid var(--bdr)",padding:"10px 22px",display:"flex",alignItems:"center",gap:10,flexShrink:0,flexWrap:"wrap"}}>
        <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",color:"var(--txt2)",display:"flex",alignItems:"center",gap:5,padding:0}}><span style={{fontSize:17}}>←</span><span style={{fontSize:12,color:"var(--txt2)"}}>Projects</span></button>
        <span style={{color:"var(--bdr2)"}}>›</span>
        <span style={{fontWeight:800,fontSize:14,color:"var(--txt)"}}>{project.name}</span>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}><Tag label={project.projectId} color="var(--txt2)"/>{project.projectTag&&<Tag label={tagLabel(project.projectTag)} color={tagColor(project.projectTag)}/>}<Pill label={(project.rag||"amber").charAt(0).toUpperCase()+(project.rag||"amber").slice(1)} color={ragColor(project.rag||"amber")} small/>{project.sanctioned&&<Pill label="Sanctioned" color="var(--green)" small/>}</div>
        {isPM&&<Btn v="ghost" style={{marginLeft:"auto",fontSize:10,padding:"4px 10px"}} onClick={()=>setShowReminder(true)}>📨 Remind</Btn>}
      </div>
      <div style={{background:"var(--s1)",borderBottom:"1px solid var(--bdr)",padding:"0 22px",display:"flex"}}>
        {[{id:"details",l:"Project Details"},{id:"execution",l:"Execution"},{id:"comms",l:"Client Communication"}].map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"9px 14px",background:"none",border:"none",cursor:"pointer",fontSize:10,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",fontFamily:"IBM Plex Mono",color:tab===t.id?"var(--acc)":"var(--txt2)",borderBottom:`2px solid ${tab===t.id?"var(--acc)":"transparent"}`,transition:"all .15s",marginBottom:-1}}>{t.l}</button>)}
      </div>
      <div style={{flex:1,overflow:"auto",padding:22}}>
        {tab==="details"&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 360px",gap:22}}>
            <div>
              <SH title="About the Project" action={isPM&&<Btn v="ghost" style={{fontSize:10,padding:"3px 9px"}} onClick={()=>setEditDesc(!editDesc)}>{editDesc?"Cancel":"✏ Edit"}</Btn>}/>
              <Card style={{padding:16,marginBottom:18}}>
                {editDesc?<div><TA value={desc} onChange={e=>setDesc(e.target.value)} rows={4}/><div style={{display:"flex",gap:6,marginTop:8,justifyContent:"flex-end"}}><Btn v="secondary" style={{fontSize:11}} onClick={()=>setEditDesc(false)}>Cancel</Btn><Btn style={{fontSize:11}} onClick={()=>{upd({...project,description:desc});setEditDesc(false);showToast("Saved ✓","var(--green)");}}>Save</Btn></div></div>
                :<div style={{fontSize:13,color:project.description?"var(--txt)":"var(--txt3)",lineHeight:1.7}}>{project.description||"No description added."}</div>}
              </Card>

              <SH title="Timeline"/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
                {[["Start",fmtDate(project.startDate),"var(--blue)"],["End",fmtDate(project.endDate),dl<0?"var(--red)":dl<14?"var(--amber)":"var(--green)"],["Days Left",dl<0?"OVERDUE":dl+"d",dl<0?"var(--red)":dl<14?"var(--amber)":"var(--txt)"]].map(([label,val,color])=>(
                  <div key={label} style={{padding:"12px 14px",background:"var(--s2)",borderRadius:8}}><div style={{fontSize:10,color:"var(--txt2)",fontFamily:"IBM Plex Mono",marginBottom:5,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</div><div style={{fontSize:15,fontWeight:800,color}}>{val}</div></div>
                ))}
              </div>

              {/* ── MINI GANTT ── */}
              <SH title="Project Gantt" color="var(--blue)"/>
              <Card style={{padding:14,marginBottom:18,overflow:"hidden"}}>
                {(()=>{
                  const start=new Date(project.startDate),end=new Date(project.endDate||"2025-12-31");
                  const total=Math.max(1,(end-start)/86400000);
                  const todayPct=Math.min(100,Math.max(0,((new Date()-start)/86400000/total)*100));
                  const phases=[{label:"HW Design",color:"var(--amber)",s:0,l:35},{label:"HW Testing",color:"var(--amber)",s:30,l:20},{label:"FW Logic",color:"var(--blue)",s:25,l:40},{label:"FW Testing",color:"var(--blue)",s:60,l:20},{label:"ID Design",color:"var(--green)",s:10,l:40},{label:"ID Testing",color:"var(--green)",s:45,l:20},{label:"Supply Chain",color:"var(--purple)",s:20,l:50},{label:"Testing",color:"var(--red)",s:75,l:20},{label:"Production",color:"var(--coral)",s:90,l:10}];
                  const months=[];const s2=new Date(start);s2.setDate(1);while(s2<=end){months.push({label:s2.toLocaleDateString("en-IN",{month:"short"}),pct:Math.max(0,Math.min(97,((s2-start)/86400000/total)*100))});s2.setMonth(s2.getMonth()+1);}
                  return(
                    <div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"var(--txt3)",fontFamily:"IBM Plex Mono",marginBottom:6}}><span>{fmtShort(project.startDate)}</span><span style={{color:"var(--red)",fontWeight:700}}>▼ Today</span><span>{fmtShort(project.endDate)}</span></div>
                      <div style={{position:"relative",height:14,marginBottom:8}}>
                        {months.map((m,i)=><span key={i} style={{position:"absolute",left:`${m.pct}%`,fontSize:8,color:"var(--txt3)",fontFamily:"IBM Plex Mono",transform:"translateX(-50%)"}}>{m.label}</span>)}
                      </div>
                      {phases.map((ph,i)=>(
                        <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                          <div style={{width:80,flexShrink:0,fontSize:9,color:"var(--txt2)",textAlign:"right"}}>{ph.label}</div>
                          <div style={{flex:1,position:"relative",height:10}}>
                            <div style={{position:"absolute",inset:0,background:"var(--bdr)",borderRadius:3}}/>
                            <div style={{position:"absolute",left:`${ph.s}%`,width:`${ph.l}%`,height:"100%",background:ph.color,borderRadius:3,opacity:.75}}/>
                            <div style={{position:"absolute",left:`${todayPct}%`,top:-1,bottom:-1,width:1.5,background:"var(--red)",opacity:.9}}/>
                          </div>
                        </div>
                      ))}
                      {/* Team assignment bars */}
                      {(project.teamAssignments||[]).slice(0,4).map((a,i)=>{
                        const u=getUser(a.userId,users);if(!u)return null;
                        const aS=new Date(a.startDate),aE=new Date(a.endDate||project.endDate);
                        const sPct=Math.max(0,((aS-start)/86400000/total)*100);
                        const len=Math.max(1,Math.min(100-sPct,((aE-aS)/86400000/total)*100));
                        return(
                          <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                            <div style={{width:80,flexShrink:0,display:"flex",alignItems:"center",gap:4,justifyContent:"flex-end"}}><Av uid={u.id} size={12} users={users}/><span style={{fontSize:9,color:"var(--txt2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.name.split(" ")[0]}</span></div>
                            <div style={{flex:1,position:"relative",height:10}}>
                              <div style={{position:"absolute",inset:0,background:"var(--bdr)",borderRadius:3}}/>
                              <div style={{position:"absolute",left:`${sPct}%`,width:`${len}%`,height:"100%",background:"var(--acc)",borderRadius:3,opacity:.6}}/>
                              <div style={{position:"absolute",left:`${todayPct}%`,top:-1,bottom:-1,width:1.5,background:"var(--red)",opacity:.9}}/>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </Card>

              {/* ── TOP ROADBLOCKS ── */}
              {(()=>{
                const allRoadblocks=[];
                Object.entries(project.checklists||{}).forEach(([clKey,clVal])=>{
                  const def=CHECKLIST_DEFS.find(d=>d.key===clKey);
                  const lists=Array.isArray(clVal)?clVal:[clVal];
                  lists.forEach(cl=>{
                    (cl.items||[]).forEach(item=>{
                      (item.roadblocks||[]).filter(rb=>!rb.resolved).forEach(rb=>{
                        allRoadblocks.push({text:rb.text,task:item.text,checklist:def?.label||clKey,time:rb.time,color:def?.color||"var(--red)"});
                      });
                    });
                  });
                });
                if(!allRoadblocks.length)return null;
                return(
                  <>
                    <SH title={`Top Roadblocks (${allRoadblocks.length} open)`} color="var(--red)"/>
                    <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:18}}>
                      {allRoadblocks.slice(0,6).map((rb,i)=>(
                        <div key={i} style={{padding:"10px 14px",background:"var(--red)08",border:"1px solid var(--red)25",borderRadius:8,display:"flex",gap:10,alignItems:"flex-start"}}>
                          <div style={{width:8,height:8,borderRadius:"50%",background:"var(--red)",flexShrink:0,marginTop:3}}/>
                          <div style={{flex:1}}>
                            <div style={{fontSize:12,fontWeight:600,color:"var(--txt)",marginBottom:2}}>{rb.text}</div>
                            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                              <Tag label={rb.checklist} color={rb.color}/>
                              <span style={{fontSize:10,color:"var(--txt3)"}}>in: {rb.task}</span>
                            </div>
                          </div>
                          <span style={{fontSize:9,color:"var(--txt3)",fontFamily:"IBM Plex Mono",flexShrink:0}}>{rb.time?.split(",")[0]||""}</span>
                        </div>
                      ))}
                      {allRoadblocks.length>6&&<div style={{fontSize:11,color:"var(--txt3)",textAlign:"center"}}>+{allRoadblocks.length-6} more — open checklists to see all</div>}
                    </div>
                  </>
                );
              })()}
            </div>

            <div>
              <SH title="Team & Dates" action={isAdmin&&<Btn v="ghost" style={{fontSize:10,padding:"3px 9px"}} onClick={()=>setEditTeam(!editTeam)}>{editTeam?"Cancel":"✏ Edit"}</Btn>}/>
              {editTeam?<TeamEditor/>:(project.teamAssignments||[]).map((a,i)=>{const m=getUser(a.userId,users);if(!m)return null;const ri=RESOURCE_ROLES.find(r=>r.key===m.resourceRole);const dur=Math.ceil((new Date(a.endDate||project.endDate)-new Date(a.startDate))/86400000);return(<div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"var(--s2)",borderRadius:8,marginBottom:5}}><Av uid={a.userId} size={30} users={users}/><div style={{flex:1}}><div style={{fontWeight:700,fontSize:12,color:"var(--txt)"}}>{m.name}</div><div style={{fontSize:10,color:"var(--txt2)"}}>{ri?.label||a.role}</div></div><div style={{textAlign:"right"}}><div style={{fontSize:10,fontFamily:"IBM Plex Mono",color:"var(--acc)"}}>{fmtShort(a.startDate)} → {fmtShort(a.endDate||project.endDate)}</div><div style={{fontSize:9,color:"var(--txt3)"}}>{dur}d</div></div></div>);})}

              {/* Checklist approval summary */}
              {(()=>{
                const summary=CHECKLIST_DEFS.filter(d=>d.key!=="production"&&project.checklists?.[d.key]?.items?.length).map(def=>{
                  const items=project.checklists[def.key].items;
                  const allTM=items.every(x=>x.tmApproval==="Approved");
                  const allPM=items.every(x=>x.pmApproval==="Approved");
                  const allClient=items.every(x=>x.clientApproval==="Approved");
                  const done=items.filter(x=>x.done).length;
                  return{def,done,total:items.length,allTM,allPM,allClient};
                });
                if(!summary.length)return null;
                return(
                  <>
                    <div style={{height:16}}/>
                    <SH title="Approval Summary" color="var(--purple)"/>
                    {summary.map(({def,done,total,allTM,allPM,allClient})=>(
                      <div key={def.key} style={{padding:"8px 12px",background:"var(--s2)",borderRadius:7,marginBottom:5}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                          <span style={{fontSize:11,fontWeight:700,color:"var(--txt)"}}>{def.icon} {def.label}</span>
                          <span style={{fontSize:10,fontFamily:"IBM Plex Mono",color:"var(--txt2)"}}>{done}/{total}</span>
                        </div>
                        <div style={{display:"flex",gap:5}}>
                          <Pill label={allTM?"TM ✓":"TM ⋯"} color={allTM?"var(--green)":"var(--amber)"} small dot={false}/>
                          <Pill label={allPM?"PM ✓":"PM ⋯"} color={allPM?"var(--green)":"var(--amber)"} small dot={false}/>
                          <Pill label={allClient?"Client ✓":"Client ⋯"} color={allClient?"var(--green)":"var(--txt3)"} small dot={false}/>
                        </div>
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>
          </div>
        )}
        {tab==="execution"&&(
          <div>
            <div style={{padding:"10px 14px",background:"var(--s2)",borderRadius:8,fontSize:11,color:"var(--txt2)",marginBottom:14}}>Click any checklist card to open it. Each card shows audit status. Upload Excel/CSV to auto-import tasks with full tracking columns.</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:10}}>
              {CHECKLIST_DEFS.filter(d=>d.key!=="production").map(def=>{
                const inst=project.checklists?.[def.key]||{};const items_=inst.items||[];const done_=items_.filter(x=>x.done).length;const pct_=items_.length?Math.round((done_/items_.length)*100):0;const aColor={"Not Reviewed":"var(--txt3)",Approved:"var(--green)",Rejected:"var(--red)","In Review":"var(--amber)"}[inst.auditStatus||"Not Reviewed"];
                return(<div key={def.key} onClick={()=>setOpenCL({def:def.key})} className="card" style={{padding:14,cursor:"pointer",transition:"all .15s",border:`1px solid ${items_.length?def.color+"30":"var(--bdr)"}`}} onMouseEnter={e=>{e.currentTarget.style.borderColor=def.color+"70";e.currentTarget.style.background="var(--s2)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor=items_.length?def.color+"30":"var(--bdr)";e.currentTarget.style.background="var(--card)";}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><div style={{width:32,height:32,borderRadius:7,background:`${def.color}18`,border:`1px solid ${def.color}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{def.icon}</div><div style={{flex:1}}><div style={{fontWeight:700,fontSize:12,color:"var(--txt)",marginBottom:1}}>{def.label}</div><div style={{fontSize:9,color:"var(--txt3)",fontFamily:"IBM Plex Mono"}}>{items_.length?`${done_}/${items_.length} done`:"Not started"}</div></div><span style={{color:"var(--txt3)",fontSize:13}}>›</span></div>
                  {items_.length?<Bar val={pct_} color={def.color} thin/>:<div style={{height:3,background:"var(--bdr)",borderRadius:99}}/>}
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:8}}><div style={{fontSize:9,color:aColor,fontFamily:"IBM Plex Mono",fontWeight:700}}>AUDIT: {inst.auditStatus||"Not Reviewed"}</div>{inst.excelFile&&<div style={{fontSize:9,color:"var(--green)",fontFamily:"IBM Plex Mono"}}>📎</div>}</div>
                </div>);
              })}
            </div>
            <Divider/>
            <SH title="Production Checklists" color="var(--red)" action={isPM&&<Btn v="ghost" style={{fontSize:10,padding:"4px 10px"}} onClick={()=>setShowProd(true)}>+ New Run</Btn>}/>
            {!(project.checklists?.production||[]).length&&<div style={{textAlign:"center",padding:"14px 0",color:"var(--txt3)",fontSize:12}}>No production runs.</div>}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:10}}>
              {(project.checklists?.production||[]).map((prod,idx)=>{const done_=(prod.items||[]).filter(x=>x.done).length;const pct_=prod.items?.length?Math.round((done_/prod.items.length)*100):0;const aColor={"Not Reviewed":"var(--txt3)",Approved:"var(--green)",Rejected:"var(--red)","In Review":"var(--amber)"}[prod.auditStatus||"Not Reviewed"];return(<div key={idx} onClick={()=>setOpenCL({def:"production",idx})} className="card" style={{padding:14,cursor:"pointer",transition:"all .15s",border:"1px solid var(--red)25"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--red)70";e.currentTarget.style.background="var(--s2)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--red)25";e.currentTarget.style.background="var(--card)";}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><div style={{width:32,height:32,borderRadius:7,background:"var(--red)18",border:"1px solid var(--red)30",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🏭</div><div style={{flex:1}}><div style={{fontWeight:700,fontSize:12,color:"var(--txt)"}}>{prod.label||`Run ${idx+1}`}</div><div style={{fontSize:9,color:"var(--txt3)",fontFamily:"IBM Plex Mono"}}>{prod.units} units · {done_}/{prod.items?.length||0}</div></div><span style={{color:"var(--txt3)",fontSize:13}}>›</span></div>
                <Bar val={pct_} color="var(--red)" thin/><div style={{fontSize:9,color:aColor,fontFamily:"IBM Plex Mono",fontWeight:700,marginTop:8}}>AUDIT: {prod.auditStatus||"Not Reviewed"}</div>
              </div>);})}
            </div>
            {showProd&&<ProdModal onClose={()=>setShowProd(false)} onAdd={addProdCL}/>}
          </div>
        )}
        {tab==="comms"&&<div style={{maxWidth:780}}><CommSection/></div>}
      </div>
      {showReminder&&<Modal title="Send Reminder" onClose={()=>setShowReminder(false)} maxW={440}><div style={{display:"flex",flexDirection:"column",gap:12}}><div><Lbl>Send To</Lbl><Sel defaultValue="all"><option value="all">All team members</option>{(project.teamAssignments||[]).map(a=>{const u=getUser(a.userId,users);return u?<option key={a.userId} value={a.userId}>{u.name}</option>:null;})}</Sel></div><div><Lbl>Message</Lbl><TA rows={4} placeholder="Enter reminder..."/></div><div style={{display:"flex",gap:6,justifyContent:"flex-end"}}><Btn v="secondary" onClick={()=>setShowReminder(false)}>Cancel</Btn><Btn v="success" onClick={()=>{showToast("Sent 📨","var(--blue)");setShowReminder(false);}}>Send</Btn></div></div></Modal>}
      {toast&&<Toast {...toast}/>}
    </div>
  );
};

/* ─── PROJECT PLAN (editable table, no week grid) ──────────────*/
const ProjectPlanView=({projects,setProjects,users})=>{
  const [rows,setRows]=useState(projects.map(p=>{
    const getUid=(role)=>{const a=p.teamAssignments?.find(x=>x.role===role);return a?a.userId:"";};
    return{id:p.id,name:p.name,type:p.projectTag||"engineering",start:p.startDate,end:p.endDate,pm:getUid("PM")||getUid("Senior PM")||"",hw:getUid("HW Engineer")||"",fw:getUid("FW Engineer")||"",enclosure:getUid("ID Engineer")||"",sc:getUid("Supply Chain")||"",soldering:getUid("Soldering")||"",tester:getUid("Tester")||"",devops:getUid("DevOps")||"",sanctioned:p.sanctioned||false,existing:true};
  }));
  const [toast,setToast]=useState(null);
  const showToast=(msg,color)=>{setToast({msg,color});setTimeout(()=>setToast(null),2600);};

  const addRow=()=>setRows(prev=>[...prev,{id:UNIQ(),name:"",type:"engineering",start:"",end:"",pm:"",hw:"",fw:"",enclosure:"",sc:"",soldering:"",tester:"",devops:"",sanctioned:false,existing:false}]);
  const updRow=(i,k,v)=>setRows(prev=>prev.map((r,idx)=>idx===i?{...r,[k]:v}:r));
  const delRow=(i)=>setRows(prev=>prev.filter((_,idx)=>idx!==i));

  const save=()=>{
    const newProjects=rows.filter(r=>!r.existing&&r.name).map(r=>({id:Date.now()+Math.random(),name:r.name,projectId:"EB-NEW-"+r.id.toString().slice(0,4),productId:"PD-NEW",projectTag:r.type,description:"",startDate:r.start,endDate:r.end,rag:"amber",sanctioned:r.sanctioned,teamAssignments:[r.pm&&{userId:Number(r.pm),role:"PM",startDate:r.start,endDate:r.end},r.hw&&{userId:Number(r.hw),role:"HW Engineer",startDate:r.start,endDate:r.end},r.fw&&{userId:Number(r.fw),role:"FW Engineer",startDate:r.start,endDate:r.end},r.enclosure&&{userId:Number(r.enclosure),role:"ID Engineer",startDate:r.start,endDate:r.end},r.sc&&{userId:Number(r.sc),role:"Supply Chain",startDate:r.start,endDate:r.end},r.soldering&&{userId:Number(r.soldering),role:"Soldering",startDate:r.start,endDate:r.end},r.tester&&{userId:Number(r.tester),role:"Tester",startDate:r.start,endDate:r.end},r.devops&&{userId:Number(r.devops),role:"DevOps",startDate:r.start,endDate:r.end}].filter(Boolean),checklists:{},communications:[],reminders:[]}));
    // update sanction on existing
    setProjects(ps=>{let updated=[...ps];rows.filter(r=>r.existing).forEach(r=>{updated=updated.map(p=>p.id===r.id?{...p,sanctioned:r.sanctioned}:p);});return[...updated,...newProjects];});
    showToast("Project plan saved ✓","var(--green)");
  };

  const RoleSel=({value,onChange,placeholder})=>(
    <Sel value={value} onChange={e=>onChange(e.target.value)} style={{padding:"4px 6px",fontSize:10,minWidth:80}}>
      <option value="">—</option>
      {nonAdmins(users).map(u=>{const ri=RESOURCE_ROLES.find(r=>r.key===u.resourceRole);return <option key={u.id} value={u.id}>{u.name} ({ri?.label||u.dept})</option>;})}
    </Sel>
  );

  const COLS=[{k:"pm",l:"PM"},{k:"hw",l:"HW"},{k:"fw",l:"FW"},{k:"enclosure",l:"Enclosure / ID"},{k:"sc",l:"Supply Chain"},{k:"soldering",l:"Soldering"},{k:"tester",l:"Tester"},{k:"devops",l:"DevOps"}];

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{display:"flex",gap:8}}><Pill label={`${rows.filter(r=>r.sanctioned).length} Sanctioned`} color="var(--green)"/><Pill label={`${rows.filter(r=>!r.sanctioned).length} Pending`} color="var(--amber)"/></div>
        <div style={{display:"flex",gap:8}}><Btn v="ghost" style={{fontSize:11,padding:"5px 12px"}} onClick={addRow}>+ Add Row</Btn><Btn v="success" style={{fontSize:11,padding:"5px 12px"}} onClick={save}>Save Plan</Btn></div>
      </div>
      <div style={{overflow:"auto",border:"1px solid var(--bdr)",borderRadius:8}}>
        <table style={{minWidth:1200}}>
          <thead>
            <tr>
              <th style={{width:160}}>Project Name</th>
              <th style={{width:110}}>Project Type</th>
              <th style={{width:95}}>Start Date</th>
              <th style={{width:95}}>End Date</th>
              {COLS.map(c=><th key={c.k} style={{width:110}}>{c.l}</th>)}
              <th style={{width:90}}>Sanction</th>
              <th style={{width:36}}/>
            </tr>
          </thead>
          <tbody>
            {rows.map((row,i)=>(
              <tr key={row.id}>
                <td><input value={row.name} onChange={e=>updRow(i,"name",e.target.value)} placeholder="Project name" style={{background:"transparent",border:"none",color:"var(--txt)",fontSize:12,outline:"none",width:"100%",fontWeight:600}}/></td>
                <td><Sel value={row.type} onChange={e=>updRow(i,"type",e.target.value)} style={{padding:"4px 6px",fontSize:10}}>{PROJECT_TAGS.map(t=><option key={t.key} value={t.key}>{t.label}</option>)}</Sel></td>
                <td><Inp type="date" value={row.start} onChange={e=>updRow(i,"start",e.target.value)} style={{padding:"4px 6px",fontSize:10}}/></td>
                <td><Inp type="date" value={row.end} onChange={e=>updRow(i,"end",e.target.value)} style={{padding:"4px 6px",fontSize:10}}/></td>
                {COLS.map(c=><td key={c.k}><RoleSel value={row[c.k]} onChange={v=>updRow(i,c.k,v)}/></td>)}
                <td style={{textAlign:"center"}}>
                  <label style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer",justifyContent:"center"}}>
                    <input type="checkbox" checked={row.sanctioned} onChange={e=>updRow(i,"sanctioned",e.target.checked)}/>
                    <span style={{fontSize:10,color:row.sanctioned?"var(--green)":"var(--txt3)",fontFamily:"IBM Plex Mono",fontWeight:700}}>{row.sanctioned?"✓":"—"}</span>
                  </label>
                </td>
                <td><button onClick={()=>delRow(i)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--txt3)",fontSize:14}}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {toast&&<Toast {...toast}/>}
    </div>
  );
};

/* ─── PERSON DETAIL MODAL ──────────────────────────────────────*/
const PersonModal=({user,projects,onClose,users})=>{
  const myProjs=projects.filter(p=>p.teamAssignments?.some(a=>a.userId===user.id));
  const ri=RESOURCE_ROLES.find(r=>r.key===user.resourceRole);
  const active=myProjs.filter(p=>{const a=p.teamAssignments?.find(x=>x.userId===user.id);return a&&a.startDate<=todayStr()&&(a.endDate||"9999")>=todayStr();});
  return(
    <Modal title={user.name} onClose={onClose} maxW={500}>
      <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:18,padding:"14px 16px",background:"var(--s2)",borderRadius:10}}>
        <Av uid={user.id} size={50} users={users}/>
        <div style={{flex:1}}><div style={{fontWeight:800,fontSize:15,marginBottom:4,color:"var(--txt)"}}>{user.name}</div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{ri&&<Tag label={ri.label} color={ri.color}/>}<Tag label={user.loginType||user.role} color="var(--txt3)"/><Tag label={user.email} color="var(--txt3)"/></div></div>
        <div style={{textAlign:"right"}}><div style={{fontSize:22,fontWeight:800,color:active.length>=(userCap(user))?"var(--red)":"var(--green)"}}>{active.length}/{userCap(user)}</div><div style={{fontSize:10,color:"var(--txt2)"}}>active/cap</div></div>
      </div>
      <SH title="Projects & Deployment Dates"/>
      {myProjs.length===0?<div style={{color:"var(--txt3)",textAlign:"center",padding:"20px 0"}}>No projects assigned</div>:myProjs.map(p=>{const a=p.teamAssignments?.find(x=>x.userId===user.id);const isNow=a&&a.startDate<=todayStr()&&(a.endDate||"9999")>=todayStr();const dl=daysLeft(a?.endDate||p.endDate);return(<div key={p.id} style={{padding:"12px 14px",background:"var(--s2)",borderRadius:8,marginBottom:7,border:`1px solid ${isNow?"var(--acc)22":"var(--bdr)"}`}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><div><div style={{fontWeight:700,fontSize:12,color:"var(--txt)",marginBottom:2}}>{p.name}</div><div style={{fontSize:10,color:"var(--txt2)"}}>{a?.role}</div></div><div style={{display:"flex",gap:5}}>{isNow&&<Pill label="Active" color="var(--acc)" small/>}<Pill label={p.rag||"amber"} color={ragColor(p.rag||"amber")} small/></div></div><div style={{display:"flex",gap:16,fontSize:11}}><div><span style={{color:"var(--txt3)"}}>Start: </span><span style={{fontFamily:"IBM Plex Mono",color:"var(--txt)"}}>{fmtDate(a?.startDate)}</span></div><div><span style={{color:"var(--txt3)"}}>End: </span><span style={{fontFamily:"IBM Plex Mono",color:dl<7?"var(--red)":dl<14?"var(--amber)":"var(--txt)"}}>{fmtDate(a?.endDate||p.endDate)}</span></div></div></div>);})}
    </Modal>
  );
};

/* ─── RESOURCE EFFICIENCY ──────────────────────────────────────*/
const EfficiencyView=({projects,users})=>{
  const members=nonAdmins(users);
  const score=(uid)=>{let tot=0,dn=0,bl=0;projects.filter(p=>p.teamAssignments?.some(a=>a.userId===uid)).forEach(p=>{Object.values(p.checklists||{}).forEach(cl=>{(Array.isArray(cl)?cl:[cl]).forEach(c=>{(c.items||[]).forEach(it=>{tot++;if(it.done)dn++;if(it.status==="Blocked")bl++;});});});});const pct=tot?Math.round((dn/tot)*100):0;return{tot,dn,bl,pct,eff:Math.max(0,pct-Math.round((bl/Math.max(1,tot))*20)),projs:projects.filter(p=>p.teamAssignments?.some(a=>a.userId===uid)).length};};
  return(
    <div>
      <div style={{fontSize:11,color:"var(--txt2)",marginBottom:14,padding:"10px 14px",background:"var(--s2)",borderRadius:8}}>Efficiency score = task completion % minus penalty for blocked items. Based on all checklist tasks across assigned projects.</div>
      <div style={{overflow:"auto",border:"1px solid var(--bdr)",borderRadius:8}}>
        <table><thead><tr><th>Name</th><th>Role</th><th>Projects</th><th>Total Tasks</th><th>Done</th><th>Blocked</th><th>Completion</th><th>Efficiency Score</th></tr></thead>
        <tbody>{members.map(m=>{const ri=RESOURCE_ROLES.find(r=>r.key===m.resourceRole);const s=score(m.id);return(<tr key={m.id}><td><div style={{display:"flex",alignItems:"center",gap:8}}><Av uid={m.id} size={24} users={users}/><span style={{fontWeight:600,color:"var(--txt)"}}>{m.name}</span></div></td><td>{ri&&<Tag label={ri.label} color={ri.color}/>}</td><td style={{textAlign:"center",fontFamily:"IBM Plex Mono"}}>{s.projs}</td><td style={{textAlign:"center",fontFamily:"IBM Plex Mono"}}>{s.tot}</td><td style={{textAlign:"center",fontFamily:"IBM Plex Mono",color:"var(--green)"}}>{s.dn}</td><td style={{textAlign:"center",fontFamily:"IBM Plex Mono",color:s.bl>0?"var(--red)":"var(--txt3)"}}>{s.bl}</td><td style={{width:120}}><Bar val={s.pct} thin/></td><td><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{flex:1,height:7,background:"var(--bdr)",borderRadius:99,overflow:"hidden"}}><div style={{width:`${s.eff}%`,height:"100%",background:s.eff>=70?"var(--green)":s.eff>=40?"var(--amber)":"var(--red)",borderRadius:99}}/></div><span style={{fontSize:11,fontWeight:800,color:s.eff>=70?"var(--green)":s.eff>=40?"var(--amber)":"var(--red)",fontFamily:"IBM Plex Mono",minWidth:28}}>{s.eff}</span></div></td></tr>);})}
        </tbody></table>
      </div>
    </div>
  );
};

/* ─── HIRING PLAN ──────────────────────────────────────────────*/
const HiringPlanView=({editable=true})=>{
  const [targets,setTargets]=useState({...HIRING_BASE});
  const [months]=useState(["Jan 2026","Feb 2026","Mar 2026","Apr 2026","May 2026","Jun 2026"]);
  const [monthly,setMonthly]=useState(()=>{const init={};RESOURCE_ROLES.forEach(r=>{init[r.key]={};months.forEach(m=>{init[r.key][m]=0;});});return init;});
  const updM=(role,month,val)=>setMonthly(prev=>({...prev,[role]:{...prev[role],[month]:Number(val)}}));
  const updA=(role,val)=>setTargets(prev=>({...prev,[role]:{...prev[role],achieved:Number(val)}}));
  return(
    <div>
      <div style={{fontSize:11,color:"var(--txt2)",marginBottom:14,padding:"10px 14px",background:"var(--s2)",borderRadius:8}}>Hiring plan for 17 projects — June 2026 target. Edit monthly additions per role. Amber = senior roles.</div>
      <div style={{overflow:"auto",border:"1px solid var(--bdr)",borderRadius:8}}>
        <table><thead><tr><th>Team</th><th>Req/4</th><th>Target 17</th><th>Achieved</th><th>Pending</th>{months.map(m=><th key={m} style={{textAlign:"center"}}>{m}</th>)}</tr></thead>
        <tbody>{RESOURCE_ROLES.map(r=>{const t=targets[r.key]||{req4:1,target17:4,achieved:0};const pending=t.target17-t.achieved;return(<tr key={r.key} style={{background:r.tier==="senior"?"var(--amber)06":""}}><td><Tag label={r.label} color={r.color}/></td><td style={{textAlign:"center",fontFamily:"IBM Plex Mono",fontStyle:"italic"}}>{t.req4}</td><td style={{textAlign:"center",fontFamily:"IBM Plex Mono",fontWeight:700}}>{t.target17}</td><td style={{textAlign:"center"}}>{editable?<input type="number" min="0" value={t.achieved} onChange={e=>updA(r.key,e.target.value)} style={{width:44,background:"var(--bg)",border:"1px solid var(--bdr)",borderRadius:4,color:"var(--green)",padding:"3px 4px",fontSize:11,textAlign:"center",outline:"none",fontFamily:"IBM Plex Mono"}}/>:<span style={{fontFamily:"IBM Plex Mono",color:"var(--green)"}}>{t.achieved}</span>}</td><td style={{textAlign:"center",fontFamily:"IBM Plex Mono",color:pending>0?"var(--red)":"var(--green)",fontWeight:700}}>{pending>0?pending:"✓"}</td>{months.map(m=><td key={m} style={{textAlign:"center"}}>{editable?<input type="number" min="0" value={monthly[r.key]?.[m]||0} onChange={e=>updM(r.key,m,e.target.value)} style={{width:44,background:"var(--bg)",border:"1px solid var(--bdr)",borderRadius:4,color:"var(--txt2)",padding:"3px 4px",fontSize:11,textAlign:"center",outline:"none",fontFamily:"IBM Plex Mono"}}/>:<span style={{fontFamily:"IBM Plex Mono",color:(monthly[r.key]?.[m]||0)>0?"var(--acc)":"var(--txt3)"}}>{monthly[r.key]?.[m]||0}</span>}</td>)}</tr>);})}
        </tbody></table>
      </div>
    </div>
  );
};

/* ─── RESOURCES VIEW ───────────────────────────────────────────*/
const ResourcesView=({projects,users,setUsers,isAdmin})=>{
  const [subView,setSubView]=useState("team");
  const [planStart,setPlanStart]=useState(()=>{const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;});
  const [periodCount,setPeriodCount]=useState(6);
  const [roleFilter,setRoleFilter]=useState("all");
  const [tierFilter,setTierFilter]=useState("all");
  const [personModal,setPersonModal]=useState(null);
  const [showAddResource,setShowAddResource]=useState(false);
  const [reminderModal,setReminderModal]=useState(null);
  const [toast,setToast]=useState(null);
  const showToast=(msg,color)=>{setToast({msg,color});setTimeout(()=>setToast(null),2600);};

  const members=nonAdmins(users);
  const periods=getHalfMonths(planStart,periodCount);
  const roleInfo=(uid)=>RESOURCE_ROLES.find(r=>r.key===getUser(uid,users)?.resourceRole);

  const filtered=members.filter(m=>{const ri=roleInfo(m.id);return(roleFilter==="all"||m.resourceRole===roleFilter)&&(tierFilter==="all"||ri?.tier===tierFilter);});

  const addResource=(newUser,projIds,pwd)=>{
    setUsers(prev=>[...prev,newUser]);
    showToast(`${newUser.name} added ✓`,"var(--green)");
  };

  const NB=({id,label})=><button onClick={()=>setSubView(id)} style={{padding:"6px 12px",background:"none",border:"none",cursor:"pointer",fontSize:10,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",fontFamily:"IBM Plex Mono",color:subView===id?"var(--acc)":"var(--txt2)",borderBottom:`2px solid ${subView===id?"var(--acc)":"transparent"}`,transition:"all .15s"}}>{label}</button>;

  return(
    <div style={{flex:1,overflow:"auto",padding:22}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:0}}>
        <div style={{display:"flex",gap:2,borderBottom:"1px solid var(--bdr)",flex:1}}>
          <NB id="team" label="Team View"/>
          <NB id="planning" label="Resource Planning"/>
          <NB id="efficiency" label="Efficiency"/>
          <NB id="hiring" label="Hiring Plan"/>
        </div>
        {isAdmin&&<Btn v="primary" style={{fontSize:11,padding:"5px 12px",marginLeft:12,flexShrink:0}} onClick={()=>setShowAddResource(true)}>+ Add Resource</Btn>}
      </div>
      <div style={{height:14}}/>

      {(subView==="team"||subView==="planning")&&(
        <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"flex-end"}}>
          <div><Lbl>Role</Lbl>
            <Sel value={roleFilter} onChange={e=>setRoleFilter(e.target.value)} style={{width:180}}>
              <option value="all">All Roles</option>
              {["senior","junior","shared"].map(tier=><optgroup key={tier} label={tier.charAt(0).toUpperCase()+tier.slice(1)+" Resources"}>{RESOURCE_ROLES.filter(r=>r.tier===tier).map(r=><option key={r.key} value={r.key}>{r.label}</option>)}</optgroup>)}
            </Sel>
          </div>
          <div><Lbl>Tier</Lbl>
            <Sel value={tierFilter} onChange={e=>setTierFilter(e.target.value)} style={{width:120}}>
              <option value="all">All</option><option value="senior">Senior</option><option value="junior">Junior</option><option value="shared">Shared</option>
            </Sel>
          </div>
          {subView==="planning"&&<>
            <div><Lbl>Cohort Start</Lbl><Inp type="date" value={planStart} onChange={e=>setPlanStart(e.target.value)} style={{width:160}}/></div>
            <div><Lbl>Half-Months</Lbl><Sel value={periodCount} onChange={e=>setPeriodCount(Number(e.target.value))} style={{width:110}}>{[3,4,6,8,10,12].map(n=><option key={n} value={n}>{n*2} periods ({n}mo)</option>)}</Sel></div>
          </>}
        </div>
      )}

      {subView==="team"&&(
        <div style={{overflow:"auto",border:"1px solid var(--bdr)",borderRadius:8}}>
          <table>
            <thead><tr><th>Name</th><th>Role</th><th>Tier</th><th>Active Projects & Dates</th><th>Capacity</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>{filtered.map(m=>{
              const ri=roleInfo(m.id);const active=activeProjs(m.id,projects);const cap=userCap(m);const over=active.length>=cap;
              return(<tr key={m.id}>
                <td><button onClick={()=>setPersonModal(m)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--acc)",display:"flex",alignItems:"center",gap:8,padding:0,fontSize:12,fontWeight:600,textDecoration:"underline"}}><Av uid={m.id} size={26} users={users}/>{m.name}</button></td>
                <td>{ri&&<Tag label={ri.label} color={ri.color}/>}</td>
                <td><Tag label={ri?.tier==="senior"?"Senior":ri?.tier==="shared"?"Shared":"Junior"} color={ri?.tier==="senior"?"var(--amber)":ri?.tier==="shared"?"var(--purple)":"var(--blue)"}/></td>
                <td>{active.length>0?active.map(p=>{const a=p.teamAssignments?.find(x=>x.userId===m.id);return <div key={p.id} style={{marginBottom:3}}><span style={{fontSize:11,fontWeight:600,color:"var(--txt)"}}>{p.name}</span><span style={{fontSize:10,color:"var(--txt3)",marginLeft:5,fontFamily:"IBM Plex Mono"}}>{fmtShort(a?.startDate)}–{fmtShort(a?.endDate||p.endDate)}</span></div>}):<span style={{fontSize:11,color:"var(--txt3)"}}>None</span>}</td>
                <td style={{textAlign:"center",fontFamily:"IBM Plex Mono",color:over?"var(--red)":"var(--green)",fontWeight:700}}>{active.length}/{cap}</td>
                <td><Pill label={over?"At Capacity":active.length>0?"Deployed":"Available"} color={over?"var(--red)":active.length>0?"var(--amber)":"var(--green)"} small/></td>
                <td><Btn v="ghost" style={{fontSize:10,padding:"3px 8px"}} onClick={()=>setReminderModal(m)}>📨</Btn></td>
              </tr>);
            })}</tbody>
          </table>
        </div>
      )}

      {subView==="planning"&&(
        <div style={{overflow:"auto"}}>
          <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
            <Pill label={`${filtered.filter(m=>activeProjs(m.id,projects).length===0).length} Available today`} color="var(--green)"/>
            <Pill label={`${filtered.filter(m=>{const a=activeProjs(m.id,projects).length;return a>0&&a<userCap(m);}).length} Partially deployed`} color="var(--amber)"/>
            <Pill label={`${filtered.filter(m=>activeProjs(m.id,projects).length>=userCap(m)).length} At capacity`} color="var(--red)"/>
          </div>
          <table style={{minWidth:periods.length*110+300}}>
            <thead><tr><th style={{width:150}}>Resource</th><th style={{width:90}}>Role</th>{periods.map((p,i)=><th key={i} style={{textAlign:"center",minWidth:100}}>{p.label}</th>)}</tr></thead>
            <tbody>{filtered.map(m=>{
              const ri=roleInfo(m.id);const cap=userCap(m);
              return(<tr key={m.id}>
                <td><button onClick={()=>setPersonModal(m)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--acc)",display:"flex",alignItems:"center",gap:6,padding:0,fontSize:11,fontWeight:600}}><Av uid={m.id} size={22} users={users}/>{m.name}</button></td>
                <td>{ri&&<Tag label={ri.label} color={ri.color}/>}</td>
                {periods.map((period,i)=>{
                  const wProjs=projects.filter(p=>p.teamAssignments?.some(a=>a.userId===m.id&&a.startDate<=period.end&&(a.endDate||"9999")>=period.start));
                  const load=wProjs.length;
                  return(<td key={i} style={{textAlign:"center",background:load===0?"var(--green)0d":load<cap?"var(--amber)0d":"var(--red)0d",border:`1px solid ${load===0?"var(--green)30":load<cap?"var(--amber)30":"var(--red)30"}`,borderRadius:4}}>
                    {load>0?<div style={{fontSize:10}}><div style={{fontWeight:700,color:load>=cap?"var(--red)":load>0?"var(--amber)":"var(--green)",fontFamily:"IBM Plex Mono"}}>{load}/{cap}</div>{wProjs.map(p=><div key={p.id} style={{fontSize:9,color:"var(--txt2)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:95}}>{p.name}</div>)}</div>:<div style={{fontSize:9,color:"var(--green)",fontFamily:"IBM Plex Mono",fontWeight:700}}>FREE</div>}
                  </td>);
                })}
              </tr>);
            })}</tbody>
          </table>
          <div style={{marginTop:10,fontSize:10,color:"var(--txt3)",fontFamily:"IBM Plex Mono"}}>Cohorts: 1st–15th and 16th–end of month</div>
        </div>
      )}

      {subView==="efficiency"&&<EfficiencyView projects={projects} users={users}/>}
      {subView==="hiring"&&<HiringPlanView/>}

      {personModal&&<PersonModal user={personModal} projects={projects} onClose={()=>setPersonModal(null)} users={users}/>}
      {showAddResource&&<AddResourceModal onClose={()=>setShowAddResource(false)} onAdd={addResource} allProjects={projects} existingUsers={users}/>}
      {reminderModal&&<Modal title={`Remind ${reminderModal.name}`} onClose={()=>setReminderModal(null)} maxW={440}>
        <div style={{display:"flex",flexDirection:"column",gap:12}}><TA rows={3} placeholder="Message..."/><div style={{display:"flex",gap:6,justifyContent:"flex-end"}}><Btn v="secondary" onClick={()=>setReminderModal(null)}>Cancel</Btn><Btn v="success" onClick={()=>{showToast(`Sent to ${reminderModal.name} 📨`,"var(--blue)");setReminderModal(null);}}>Send</Btn></div></div>
      </Modal>}
      {toast&&<Toast {...toast}/>}
    </div>
  );
};

/* ─── ALERTS VIEW ──────────────────────────────────────────────*/
const AlertsView=({projects,currentUser,users})=>{
  const [filter,setFilter]=useState("All");
  const [reminderProj,setReminderProj]=useState(null);
  const [toast,setToast]=useState(null);
  const showToast=(msg,color)=>{setToast({msg,color});setTimeout(()=>setToast(null),2600);};
  const aC={critical:"var(--red)",warning:"var(--amber)",info:"var(--blue)",success:"var(--green)"};
  const allAlerts=[];
  projects.forEach(p=>{const dl=daysLeft(p.endDate);if(p.rag==="red")allAlerts.push({t:"critical",proj:p,msg:`RAG Red · ${dl}d remaining`});if(dl<14&&dl>0)allAlerts.push({t:"warning",proj:p,msg:`Deadline in ${dl}d`});if((p.communications||[]).some(c=>c.type==="major"&&c.status==="pending_approval"))allAlerts.push({t:"critical",proj:p,msg:`Major change awaiting approval`});if(!p.sanctioned)allAlerts.push({t:"info",proj:p,msg:`Project not yet sanctioned`});if(p.rag==="green")allAlerts.push({t:"success",proj:p,msg:`On track for delivery`});});
  nonAdmins(users).forEach(m=>{const act=activeProjs(m.id,projects);if(act.length>userCap(m))allAlerts.push({t:"warning",proj:null,msg:`${m.name} exceeds capacity (${act.length}/${userCap(m)})`});});
  const filtered=filter==="All"?allAlerts:allAlerts.filter(a=>a.t===filter);
  const grouped={};filtered.forEach(a=>{const k=a.proj?.id||"__global";if(!grouped[k])grouped[k]={proj:a.proj,alerts:[]};grouped[k].alerts.push(a);});
  return(
    <div>
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{display:"flex",gap:5}}>{["All","critical","warning","info","success"].map(f=><Btn key={f} v={filter===f?"primary":"secondary"} style={{fontSize:10,padding:"4px 10px"}} onClick={()=>setFilter(f)}>{f.charAt(0).toUpperCase()+f.slice(1)}</Btn>)}</div>
        <div style={{marginLeft:"auto",display:"flex",gap:5}}>{["critical","warning","info","success"].map(t=><Pill key={t} label={`${allAlerts.filter(a=>a.t===t).length} ${t}`} color={aC[t]} small/>)}</div>
      </div>
      {Object.values(grouped).map((group,gi)=>(
        <div key={gi} style={{marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>{group.proj?<><span style={{fontWeight:700,fontSize:13,color:"var(--txt)"}}>{group.proj.name}</span><Tag label={group.proj.projectId} color="var(--txt2)"/>{group.proj.projectTag&&<Tag label={tagLabel(group.proj.projectTag)} color={tagColor(group.proj.projectTag)}/>}<Pill label={group.proj.rag||"amber"} color={ragColor(group.proj.rag||"amber")} small/></>:<span style={{fontWeight:700,fontSize:13,color:"var(--txt2)"}}>Global / Resource</span>}</div>
            {group.proj&&<Btn v="ghost" style={{fontSize:10,padding:"3px 9px"}} onClick={()=>setReminderProj(group.proj)}>📨 Remind Team</Btn>}
          </div>
          {group.alerts.map((a,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"var(--s2)",border:`1px solid ${aC[a.t]}22`,borderRadius:7,padding:"9px 12px",marginBottom:5}}>
              <div style={{display:"flex",gap:8,alignItems:"flex-start"}}><div style={{width:7,height:7,borderRadius:"50%",background:aC[a.t],flexShrink:0,marginTop:4}}/><div><div style={{fontSize:9,color:aC[a.t],fontWeight:700,fontFamily:"IBM Plex Mono",marginBottom:2}}>{a.t.toUpperCase()}</div><div style={{fontSize:12,color:"var(--txt)"}}>{a.msg}</div></div></div>
              <Btn v="ghost" style={{fontSize:10,padding:"3px 8px",flexShrink:0}} onClick={()=>setReminderProj(a.proj||{name:"All",teamAssignments:nonAdmins(users).map(u=>({userId:u.id}))})}>📨</Btn>
            </div>
          ))}
        </div>
      ))}
      {filtered.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:"var(--txt3)"}}>No alerts.</div>}
      {reminderProj&&<Modal title={`Send Reminder — ${reminderProj.name}`} onClose={()=>setReminderProj(null)} maxW={440}>
        <div style={{display:"flex",flexDirection:"column",gap:12}}><div><Lbl>Send To</Lbl><Sel defaultValue="all"><option value="all">All team members</option>{(reminderProj.teamAssignments||[]).map(a=>{const u=getUser(a.userId,users);return u?<option key={a.userId} value={a.userId}>{u.name}</option>:null;})}</Sel></div><div><Lbl>Message</Lbl><TA rows={3} placeholder="Message..."/></div><div style={{display:"flex",gap:6,justifyContent:"flex-end"}}><Btn v="secondary" onClick={()=>setReminderProj(null)}>Cancel</Btn><Btn v="success" onClick={()=>{showToast("Sent 📨","var(--blue)");setReminderProj(null);}}>Send</Btn></div></div>
      </Modal>}
      {toast&&<Toast {...toast}/>}
    </div>
  );
};

/* ─── PROJECT FORM ─────────────────────────────────────────────*/
const ProjectForm=({initial,onSave,onClose,allProjects,users})=>{
  const blank={name:"",projectId:"",productId:"",projectTag:"engineering",description:"",startDate:"",endDate:"",teamAssignments:[]};
  const [f,setF]=useState(initial||blank);const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const [assignments,setAssignments]=useState(initial?.teamAssignments||[]);
  const addR=()=>setAssignments(prev=>[...prev,{userId:nonAdmins(users)[0]?.id,role:"Member",startDate:f.startDate||todayStr(),endDate:f.endDate||""}]);
  const updR=(i,k,v)=>setAssignments(prev=>prev.map((a,idx)=>idx===i?{...a,[k]:v}:a));
  const delR=(i)=>setAssignments(prev=>prev.filter((_,idx)=>idx!==i));
  const avail=(excludeId)=>nonAdmins(users).filter(u=>{const ac=activeProjs(u.id,allProjects).filter(p=>p.id!==initial?.id).length;return u.id===excludeId||ac<userCap(u);});
  const conflicts=[];assignments.forEach((a,i)=>{activeProjs(a.userId,allProjects).filter(p=>p.id!==initial?.id).forEach(p=>{const oa=p.teamAssignments?.find(x=>x.userId===a.userId);if(oa&&a.startDate&&a.endDate&&!(oa.endDate<a.startDate||a.endDate<oa.startDate))conflicts.push({i,name:getUser(a.userId,users)?.name,proj:p.name});});});
  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 14px"}}>
        <div style={{gridColumn:"span 2"}}><Lbl>Project Name</Lbl><Inp value={f.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Smart Plug v3"/></div>
        <div><Lbl>Project ID</Lbl><Inp value={f.projectId} onChange={e=>set("projectId",e.target.value)} placeholder="EB-2408"/></div>
        <div><Lbl>Product ID</Lbl><Inp value={f.productId} onChange={e=>set("productId",e.target.value)} placeholder="PD-150"/></div>
        <div><Lbl>Project Tag</Lbl><Sel value={f.projectTag} onChange={e=>set("projectTag",e.target.value)}>{PROJECT_TAGS.map(t=><option key={t.key} value={t.key}>{t.label}</option>)}</Sel></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <div><Lbl>Start Date</Lbl><Inp type="date" value={f.startDate} onChange={e=>set("startDate",e.target.value)}/></div>
          <div><Lbl>End Date</Lbl><Inp type="date" value={f.endDate} onChange={e=>set("endDate",e.target.value)}/></div>
        </div>
        <div style={{gridColumn:"span 2"}}><Lbl>Description</Lbl><TA value={f.description} onChange={e=>set("description",e.target.value)} rows={2}/></div>
      </div>
      <Divider/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><Lbl style={{marginBottom:0}}>Team Assignments</Lbl><Btn v="ghost" style={{fontSize:10,padding:"3px 9px"}} onClick={addR}>+ Add Person</Btn></div>
      {conflicts.length>0&&<div style={{padding:"8px 12px",background:"var(--red)10",border:"1px solid var(--red)30",borderRadius:6}}><div style={{fontSize:10,color:"var(--red)",fontWeight:700,fontFamily:"IBM Plex Mono",marginBottom:3}}>⚠ CONFLICTS</div>{conflicts.map((c,i)=><div key={i} style={{fontSize:11,color:"var(--amber)"}}>{c.name} already on {c.proj}</div>)}</div>}
      <div style={{fontSize:10,color:"var(--green)",fontFamily:"IBM Plex Mono"}}>✓ within capacity  ⚠ at/over capacity</div>
      {assignments.map((a,i)=>{const av=avail(a.userId);return(<div key={i} style={{display:"grid",gridTemplateColumns:"1fr 110px 90px 90px 24px",gap:6,alignItems:"center",marginBottom:5}}><Sel value={a.userId} onChange={e=>updR(i,"userId",Number(e.target.value))} style={{padding:"5px 8px",fontSize:11}}>{nonAdmins(users).map(u=>{const ri=RESOURCE_ROLES.find(r=>r.key===u.resourceRole);const ok=av.find(av=>av.id===u.id);return <option key={u.id} value={u.id}>{ok?"✓":"⚠"} {u.name} — {ri?.label||u.dept}</option>;})}</Sel><Inp value={a.role} onChange={e=>updR(i,"role",e.target.value)} style={{padding:"5px 7px",fontSize:11}} placeholder="Role"/><Inp type="date" value={a.startDate} onChange={e=>updR(i,"startDate",e.target.value)} style={{padding:"5px 7px",fontSize:11}}/><Inp type="date" value={a.endDate} onChange={e=>updR(i,"endDate",e.target.value)} style={{padding:"5px 7px",fontSize:11}}/><button onClick={()=>delR(i)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--red)",fontSize:15,padding:0}}>×</button></div>);})}
      <div style={{display:"flex",gap:8,justifyContent:"flex-end",paddingTop:4}}><Btn v="secondary" onClick={onClose}>Cancel</Btn><Btn onClick={()=>{if(!f.name)return alert("Name required");onSave({...f,teamAssignments:assignments});}}>💾 Save Project</Btn></div>
    </div>
  );
};

/* ─── SUPER ADMIN VIEW ─────────────────────────────────────────*/
const SuperAdminView=({projects,setProjects,currentUser,openProject,users,setUsers,isDark})=>{
  const [view,setView]=useState("projects");
  const [search,setSearch]=useState("");
  const [tagFilter,setTagFilter]=useState("All");
  const [showAdd,setShowAdd]=useState(false);
  const [toast,setToast]=useState(null);
  const showToast=(msg,color)=>{setToast({msg,color});setTimeout(()=>setToast(null),2600);};

  const filtered=projects.filter(p=>(p.name.toLowerCase().includes(search.toLowerCase())||p.projectId.toLowerCase().includes(search.toLowerCase()))&&(tagFilter==="All"||p.projectTag===tagFilter));
  const saveProject=(form)=>{if(form.id)setProjects(ps=>ps.map(p=>p.id===form.id?{...form}:p));else setProjects(ps=>[...ps,{...form,id:Date.now(),rag:"amber",sanctioned:false,checklists:{},communications:[],reminders:[]}]);setShowAdd(false);showToast("Project saved ✓","var(--green)");};

  const stats=[{label:"Total",value:projects.length},{label:"Engineering",value:projects.filter(p=>p.projectTag==="engineering").length,color:"var(--blue)"},{label:"EB Product",value:projects.filter(p=>p.projectTag==="elecbits_product").length,color:"var(--green)"},{label:"Modifier",value:projects.filter(p=>p.projectTag==="modifier").length,color:"var(--purple)"},{label:"Sanctioned",value:projects.filter(p=>p.sanctioned).length,color:"var(--green)"},{label:"Pending",value:projects.filter(p=>!p.sanctioned).length,color:"var(--amber)"}];
  const NB=({id,label})=><button onClick={()=>setView(id)} style={{padding:"7px 12px",background:"none",border:"none",cursor:"pointer",fontSize:10,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",fontFamily:"IBM Plex Mono",color:view===id?"var(--acc)":"var(--txt2)",borderBottom:`2px solid ${view===id?"var(--acc)":"transparent"}`,transition:"all .15s"}}>{label}</button>;

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{borderBottom:"1px solid var(--bdr)",display:"flex",gap:0,padding:"0 22px",background:"var(--s1)"}}><NB id="projects" label="Projects"/><NB id="project_plan" label="Project Plan"/><NB id="resources" label="Resources"/><NB id="alerts" label="Alerts"/></div>
      <div style={{flex:1,overflow:"auto",padding:22}}>
        {view==="projects"&&<>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:10,marginBottom:18}}>{stats.map(s=><Stat key={s.label} {...s}/>)}</div>
          <div style={{display:"flex",gap:10,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
            <Inp placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} style={{width:180,fontSize:12}}/>
            <Sel value={tagFilter} onChange={e=>setTagFilter(e.target.value)} style={{width:180,fontSize:12}}><option value="All">All Tags</option>{PROJECT_TAGS.map(t=><option key={t.key} value={t.key}>{t.label}</option>)}</Sel>
            <Btn onClick={()=>setShowAdd(true)} style={{marginLeft:"auto"}}>+ New Project</Btn>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 120px 100px",gap:8,padding:"5px 12px",fontSize:10,color:"var(--txt3)",fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",fontFamily:"IBM Plex Mono",marginBottom:4}}>
            <span>Project</span><span>Tag</span><span>Start</span><span>End</span><span>PM</span><span>Progress</span><span>Status</span>
          </div>
          {filtered.map(p=>{
            const dl=daysLeft(p.endDate);const pm=getPM(p,users);
            const cl=p.checklists||{};
            const tot=Object.values(cl).reduce((a,v)=>{if(Array.isArray(v))return a+v.reduce((b,c)=>b+(c.items||[]).length,0);return a+(v.items||[]).length;},0);
            const dn=Object.values(cl).reduce((a,v)=>{if(Array.isArray(v))return a+v.reduce((b,c)=>b+(c.items||[]).filter(x=>x.done).length,0);return a+(v.items||[]).filter(x=>x.done).length;},0);
            const pct=tot?Math.round((dn/tot)*100):0;
            return(<div key={p.id} onClick={()=>openProject(p)} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 120px 100px",gap:8,padding:"11px 12px",background:"var(--s1)",border:"1px solid var(--bdr)",borderRadius:7,marginBottom:4,cursor:"pointer",alignItems:"center",transition:"all .15s"}} onMouseEnter={e=>e.currentTarget.style.background="var(--s2)"} onMouseLeave={e=>e.currentTarget.style.background="var(--s1)"}>
              <div><div style={{fontWeight:700,fontSize:13,color:"var(--txt)",marginBottom:2}}>{p.name}</div><div style={{fontSize:10,color:"var(--txt2)"}}>{p.projectId}</div></div>
              {p.projectTag?<Tag label={tagLabel(p.projectTag)} color={tagColor(p.projectTag)}/>:<span/>}
              <span style={{fontSize:11,color:"var(--txt2)"}}>{fmtDate(p.startDate)}</span>
              <span style={{fontSize:11,color:dl<7?"var(--red)":dl<14?"var(--amber)":"var(--txt2)"}}>{fmtDate(p.endDate)}</span>
              <div style={{display:"flex",alignItems:"center",gap:5}}>{pm&&<><Av uid={pm.id} size={20} users={users}/><span style={{fontSize:11,color:"var(--txt2)"}}>{pm.name}</span></>}</div>
              <Bar val={pct} thin/>
              <div style={{display:"flex",gap:4}}><Pill label={p.rag||"amber"} color={ragColor(p.rag||"amber")} small/>{p.sanctioned&&<Pill label="✓" color="var(--green)" small/>}</div>
            </div>);
          })}
        </>}
        {view==="project_plan"&&<ProjectPlanView projects={projects} setProjects={setProjects} users={users}/>}
        {view==="resources"&&<ResourcesView projects={projects} users={users} setUsers={setUsers} isAdmin={true}/>}
        {view==="alerts"&&<AlertsView projects={projects} currentUser={currentUser} users={users}/>}
      </div>
      {showAdd&&<Modal title="New Project" onClose={()=>setShowAdd(false)} wide><ProjectForm onSave={saveProject} onClose={()=>setShowAdd(false)} allProjects={projects} users={users}/></Modal>}
      {toast&&<Toast {...toast}/>}
    </div>
  );
};

/* ─── PM VIEW ──────────────────────────────────────────────────*/
const PMView=({projects,currentUser,openProject,users})=>{
  const myProjects=projects.filter(p=>p.teamAssignments?.some(a=>a.userId===currentUser.id));
  const [view,setView]=useState("projects");
  const NB=({id,label})=><button onClick={()=>setView(id)} style={{padding:"7px 12px",background:"none",border:"none",cursor:"pointer",fontSize:10,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",fontFamily:"IBM Plex Mono",color:view===id?"var(--acc)":"var(--txt2)",borderBottom:`2px solid ${view===id?"var(--acc)":"transparent"}`,transition:"all .15s"}}>{label}</button>;
  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{borderBottom:"1px solid var(--bdr)",display:"flex",gap:0,padding:"0 22px",background:"var(--s1)"}}><NB id="projects" label="My Projects"/><NB id="alerts" label="Alerts"/></div>
      <div style={{flex:1,overflow:"auto",padding:22}}>
        {view==="projects"&&<>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:10,marginBottom:18}}><Stat label="My Projects" value={myProjects.length} color="var(--blue)"/><Stat label="On Track" value={myProjects.filter(p=>p.rag==="green").length} color="var(--green)"/><Stat label="At Risk" value={myProjects.filter(p=>p.rag!=="green").length} color="var(--amber)"/></div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 100px",gap:8,padding:"5px 12px",fontSize:10,color:"var(--txt3)",fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",fontFamily:"IBM Plex Mono",marginBottom:4}}><span>Project</span><span>Tag</span><span>Start</span><span>End</span><span>PM</span><span>Status</span></div>
          {myProjects.map(p=>{const dl=daysLeft(p.endDate);const pm=getPM(p,users);return(<div key={p.id} onClick={()=>openProject(p)} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 100px",gap:8,padding:"11px 12px",background:"var(--s1)",border:"1px solid var(--bdr)",borderRadius:7,marginBottom:4,cursor:"pointer",alignItems:"center",transition:"all .15s"}} onMouseEnter={e=>e.currentTarget.style.background="var(--s2)"} onMouseLeave={e=>e.currentTarget.style.background="var(--s1)"}><div><div style={{fontWeight:700,fontSize:13,color:"var(--txt)",marginBottom:2}}>{p.name}</div><div style={{fontSize:10,color:"var(--txt2)"}}>{p.projectId}</div></div>{p.projectTag?<Tag label={tagLabel(p.projectTag)} color={tagColor(p.projectTag)}/>:<span/>}<span style={{fontSize:11,color:"var(--txt2)"}}>{fmtDate(p.startDate)}</span><span style={{fontSize:11,color:dl<14?"var(--amber)":"var(--txt2)"}}>{fmtDate(p.endDate)}</span><div style={{display:"flex",alignItems:"center",gap:5}}>{pm&&<><Av uid={pm.id} size={20} users={users}/><span style={{fontSize:11,color:"var(--txt2)"}}>{pm.name}</span></>}</div><Pill label={p.rag||"amber"} color={ragColor(p.rag||"amber")} small/></div>);})}
        </>}
        {view==="alerts"&&<AlertsView projects={myProjects} currentUser={currentUser} users={users}/>}
      </div>
    </div>
  );
};

/* ─── DEV VIEW ─────────────────────────────────────────────────*/
const DevView=({projects,currentUser,openProject,users})=>{
  const myProjects=projects.filter(p=>p.teamAssignments?.some(a=>a.userId===currentUser.id));
  return(
    <div style={{flex:1,overflow:"auto",padding:22}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:10,marginBottom:18}}><Stat label="My Projects" value={myProjects.length} color="var(--blue)"/><Stat label="On Track" value={myProjects.filter(p=>p.rag==="green").length} color="var(--green)"/><Stat label="At Risk" value={myProjects.filter(p=>p.rag!=="green").length} color="var(--amber)"/></div>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 100px",gap:8,padding:"5px 12px",fontSize:10,color:"var(--txt3)",fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",fontFamily:"IBM Plex Mono",marginBottom:4}}><span>Project</span><span>Tag</span><span>My Start</span><span>My End</span><span>PM</span><span>Status</span></div>
      {myProjects.map(p=>{const a=p.teamAssignments?.find(x=>x.userId===currentUser.id);const dl=daysLeft(a?.endDate||p.endDate);const pm=getPM(p,users);return(<div key={p.id} onClick={()=>openProject(p)} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 100px",gap:8,padding:"11px 12px",background:"var(--s1)",border:"1px solid var(--bdr)",borderRadius:7,marginBottom:4,cursor:"pointer",alignItems:"center",transition:"all .15s"}} onMouseEnter={e=>e.currentTarget.style.background="var(--s2)"} onMouseLeave={e=>e.currentTarget.style.background="var(--s1)"}><div><div style={{fontWeight:700,fontSize:13,color:"var(--txt)",marginBottom:2}}>{p.name}</div><div style={{fontSize:10,color:"var(--txt2)"}}>{a?.role}</div></div>{p.projectTag?<Tag label={tagLabel(p.projectTag)} color={tagColor(p.projectTag)}/>:<span/>}<span style={{fontSize:11,color:"var(--txt2)"}}>{fmtDate(a?.startDate||p.startDate)}</span><span style={{fontSize:11,color:dl<14?"var(--amber)":"var(--txt2)"}}>{fmtDate(a?.endDate||p.endDate)}</span><div style={{display:"flex",alignItems:"center",gap:5}}>{pm&&<><Av uid={pm.id} size={20} users={users}/><span style={{fontSize:11,color:"var(--txt2)"}}>{pm.name}</span></>}</div><Pill label={p.rag||"amber"} color={ragColor(p.rag||"amber")} small/></div>);})}
    </div>
  );
};

/* ─── LOGIN ────────────────────────────────────────────────────*/
const Login=({onLogin,isDark,toggleTheme,users})=>{
  const [email,setEmail]=useState("");const [pass,setPass]=useState("");const [err,setErr]=useState("");const [loading,setLoading]=useState(false);
  const [passwords]=useState({...INIT_PASSWORDS});
  const submit=()=>{setLoading(true);setTimeout(()=>{const user=users.find(u=>u.email===email);if(!user||passwords[email]!==pass){setErr("Invalid credentials.");setLoading(false);return;}onLogin(user);},600);};
  const demos=[{r:"Super Admin",e:"aryan@elecbits.in",p:"admin123",c:"var(--acc)"},{r:"PM — Priya",e:"priya@elecbits.in",p:"pm123",c:"var(--green)"},{r:"HW Dev",e:"rohit@elecbits.in",p:"dev123",c:"var(--amber)"},{r:"FW Dev",e:"sneha@elecbits.in",p:"dev123",c:"var(--amber)"}];
  return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg)",padding:20,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(var(--bdr) 1px,transparent 1px),linear-gradient(90deg,var(--bdr) 1px,transparent 1px)",backgroundSize:"40px 40px",opacity:.15}}/>
      <div style={{position:"absolute",top:16,right:16}}><ThemeToggle isDark={isDark} toggle={toggleTheme}/></div>
      <div style={{width:"100%",maxWidth:400,position:"relative",animation:"fadeUp .4s ease"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:10,marginBottom:8}}><div style={{width:32,height:32,background:"var(--acc)",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:16,fontFamily:"IBM Plex Mono",fontWeight:700,color:"#fff"}}>E</span></div><span style={{fontSize:20,fontWeight:900,letterSpacing:"-0.02em",fontFamily:"IBM Plex Mono",color:"var(--txt)"}}>ELECBITS</span></div>
          <div style={{fontSize:10,color:"var(--txt2)",fontFamily:"IBM Plex Mono",letterSpacing:"0.1em",textTransform:"uppercase"}}>Project Management System v6</div>
        </div>
        <div className="card" style={{padding:24}}>
          <div style={{marginBottom:12}}><Lbl>Email</Lbl><Inp type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@elecbits.in"/></div>
          <div style={{marginBottom:18}}><Lbl>Password</Lbl><Inp type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&submit()}/></div>
          {err&&<div style={{color:"var(--red)",fontSize:12,marginBottom:12,padding:"7px 10px",background:"var(--red)12",borderRadius:5,border:"1px solid var(--red)30"}}>{err}</div>}
          <Btn onClick={submit} style={{width:"100%",justifyContent:"center",padding:9}} disabled={loading}>{loading?<span style={{width:13,height:13,border:"2px solid #ffffff40",borderTop:"2px solid #fff",borderRadius:"50%",animation:"spin .7s linear infinite",display:"inline-block"}}/>:"Sign In →"}</Btn>
          <div style={{marginTop:14,padding:12,background:"var(--s2)",borderRadius:7,border:"1px solid var(--bdr)"}}>
            <div style={{fontSize:10,color:"var(--txt2)",fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",fontFamily:"IBM Plex Mono",marginBottom:8}}>Quick Login</div>
            {demos.map(d=><div key={d.r} onClick={()=>{setEmail(d.e);setPass(d.p);}} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",cursor:"pointer"}}><span style={{fontSize:11,color:d.c,fontWeight:700,fontFamily:"IBM Plex Mono"}}>{d.r}</span><span style={{fontSize:10,color:"var(--txt3)",fontFamily:"IBM Plex Mono"}}>{d.e}</span></div>)}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── HEADER ───────────────────────────────────────────────────*/
const Header=({user,onLogout,isDark,toggleTheme,users})=>{
  const roleColor={superadmin:"var(--acc)",pm:"var(--green)",developer:"var(--amber)"}[user.role];
  const roleLabel={superadmin:"Super Admin",pm:"Project Manager",developer:user.dept||"Developer"}[user.role];
  return(
    <div style={{background:"var(--s1)",borderBottom:"1px solid var(--bdr)",padding:"0 22px",display:"flex",alignItems:"center",height:50,flexShrink:0,gap:10}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:24,height:24,background:"var(--acc)",borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:13,fontFamily:"IBM Plex Mono",fontWeight:700,color:"#fff"}}>E</span></div><span style={{fontSize:13,fontWeight:800,letterSpacing:"0.05em",fontFamily:"IBM Plex Mono",color:"var(--txt)"}}>ELECBITS PMS</span><Tag label="v6" color="var(--txt3)"/></div>
      <div style={{flex:1}}/>
      <ThemeToggle isDark={isDark} toggle={toggleTheme}/>
      <div style={{display:"flex",alignItems:"center",gap:10}}><Av uid={user.id} size={26} users={users}/><div><div style={{fontSize:12,fontWeight:700,color:"var(--txt)"}}>{user.name}</div><div style={{fontSize:9,fontFamily:"IBM Plex Mono",color:roleColor,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em"}}>{roleLabel}</div></div><Btn v="secondary" style={{fontSize:10,padding:"4px 10px"}} onClick={onLogout}>Out</Btn></div>
    </div>
  );
};

/* ─── ROOT ─────────────────────────────────────────────────────*/
export default function App(){
  const [isDark,setIsDark]=useState(true);
  const [user,setUser]=useState(null);
  const [projects,setProjects]=useState(INIT_PROJECTS);
  const [openedProject,setOpenedProject]=useState(null);
  const [users,setUsers]=useState(INIT_USERS);

  const toggleTheme=()=>{const next=!isDark;setIsDark(next);applyTheme(next);};

  // Apply initial theme
  useState(()=>{applyTheme(true);});

  const updateProject=(updated)=>{setProjects(ps=>ps.map(p=>p.id===updated.id?updated:p));setOpenedProject(updated);};
  const currentProject=openedProject?projects.find(p=>p.id===openedProject.id)||openedProject:null;

  return(
    <>
      <G isDark={isDark}/>
      {!user?<Login onLogin={setUser} isDark={isDark} toggleTheme={toggleTheme} users={users}/>:(
        <div style={{display:"flex",flexDirection:"column",height:"100vh",overflow:"hidden",background:"var(--bg)"}}>
          <Header user={user} onLogout={()=>{setUser(null);setOpenedProject(null);}} isDark={isDark} toggleTheme={toggleTheme} users={users}/>
          <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
            {currentProject?(
              <ProjectPage project={currentProject} currentUser={user} onBack={()=>setOpenedProject(null)} onUpdateProject={updateProject} allProjects={projects} setProjects={setProjects} users={users}/>
            ):(
              <>
                {user.role==="superadmin"&&<SuperAdminView projects={projects} setProjects={setProjects} currentUser={user} openProject={setOpenedProject} users={users} setUsers={setUsers} isDark={isDark}/>}
                {user.role==="pm"&&<PMView projects={projects} currentUser={user} openProject={setOpenedProject} users={users}/>}
                {user.role==="developer"&&<DevView projects={projects} currentUser={user} openProject={setOpenedProject} users={users}/>}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
