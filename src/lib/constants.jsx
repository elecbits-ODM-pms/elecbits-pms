export const RESOURCE_ROLES=[
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

export const HIRING_BASE={sr_hw:{req4:1,target17:4,achieved:2},jr_hw:{req4:2,target17:9,achieved:5},sr_fw:{req4:1,target17:4,achieved:3},jr_fw:{req4:3,target17:13,achieved:7},tester:{req4:1,target17:4,achieved:0},ind_design:{req4:1,target17:4,achieved:1},sr_pm:{req4:1,target17:4,achieved:1},jr_pm:{req4:2,target17:9,achieved:6},sol_arch:{req4:1,target17:4,achieved:0},devops:{req4:1,target17:4,achieved:0},sc:{req4:1,target17:4,achieved:0},soldering:{req4:1,target17:4,achieved:0}};

export const PROJECT_TAGS=[{key:"engineering",label:"Engineering Project",color:"var(--blue)"},{key:"elecbits_product",label:"Elecbits Product",color:"var(--green)"},{key:"modifier",label:"Modifier",color:"var(--purple)"}];
export const tagColor=(k)=>PROJECT_TAGS.find(t=>t.key===k)?.color||"var(--txt3)";
export const tagLabel=(k)=>PROJECT_TAGS.find(t=>t.key===k)?.label||k;

export const CHECKLIST_DEFS=[
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

export const DEFAULT_ITEMS={gantt:["Project kick-off date confirmed","Milestone dates agreed","Phase 1 (HW) timeline locked","Phase 2 (FW) timeline locked","Phase 3 (ID) timeline locked","Supply chain lead time mapped","Buffer weeks allocated","Client review dates scheduled","Final delivery date confirmed","Gantt shared and approved"],pm_milestone:["Kick-off meeting done","NDA / contract signed","Spec document v1 approved","BOM approved","Design review completed","Prototype 1 sign-off","Client feedback incorporated","Final spec locked","Delivery schedule confirmed","Project closure checklist done"],hw_design:["Schematic v1 drafted","Power architecture reviewed","Signal integrity checked","BOM finalized","PCB layout done","Design rule check passed","Gerber files generated","Schematic peer reviewed","Component availability verified","Final schematic sign-off"],hw_testing:["Prototype assembled","Power-on test done","Voltage rail checks done","Current consumption measured","Communication interfaces tested","Thermal testing done","EMI pre-scan done","Functional test pass","Failure analysis documented","Test report generated"],fw_logic:["Architecture doc drafted","Bootloader configured","RTOS / bare-metal setup","Driver layer done","Application logic done","Unit tests written","Code review done","Static analysis done","Build reproducible","Firmware version tagged"],fw_testing:["Test plan written","Smoke test pass","Feature test pass","Regression suite run","Edge case tests done","Memory leak check","OTA update tested","Final firmware locked","Test report generated","Firmware flashed on pilot units"],id_design:["Initial sketches approved","CAD model v1 done","DFM review done","Tooling feasibility confirmed","Material selection finalized","Color / finish confirmed","Enclosure BOM done","3D print prototype approved","Drawings released","ID sign-off done"],id_testing:["3D print fit-check done","Assembly test done","Drop test done","Ingress protection tested","Label placement verified","Cosmetic inspection done","Tooling first article done","Client sample approved","Mass production sample approved","ID test report generated"],overall_testing:["All subsystems integrated","System-level test plan done","Happy-path tests done","Stress tests done","Compatibility tests done","Safety tests done","Regulatory compliance verified","Third-party lab report received","Final test sign-off","Product approved for production"]};

export const genProdItems=(u)=>[`PO confirmed — ${u} units`,"BOM finalized","Component procurement started","PCB fab order placed","PCBA order placed","Enclosure tooling confirmed","First article inspection done",`SMT line programmed for ${u} units`,"ICT fixtures ready","Functional test fixtures ready",`Pilot run (10% of ${u}) completed`,"Pilot defect rate < 1%","Full production run started",`${u} units assembled`,"Final QC done","Packaging confirmed","Serial numbers applied",`${u} units dispatched`];

export const mkItem=(text,i)=>({id:`${i}-${Math.random().toString(36).slice(2,6)}`,text,done:false,status:"Pending",startDate:"",endDate:"",assigneeId:"",tmApproval:"Pending",pmApproval:"Pending",clientApproval:"Pending",links:[],remarks:"",lastUpdated:new Date().toISOString().slice(0,10),comments:[],roadblocks:[],submittedForReview:false});

export const CL_OWNERS={
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

export const canEditCL=(user,clKey)=>{
  if(user.role==="superadmin"||user.role==="pm")return true;
  const allowed=CL_OWNERS[clKey]||[];
  return allowed.includes(user.resourceRole);
};
export const canApprove=(user)=>user.role==="superadmin"||user.role==="pm";

export const TEAM_SLOTS=[
  {role:"Senior PM",roleKeys:["sr_pm"],label:"Senior PM"},
  {role:"PM",roleKeys:["jr_pm","sr_pm"],label:"PM"},
  {role:"Sr. Hardware",roleKeys:["sr_hw"],label:"Sr. Hardware Engineer"},
  {role:"Jr. Hardware",roleKeys:["jr_hw"],label:"Jr. Hardware Engineer"},
  {role:"Sr. Firmware",roleKeys:["sr_fw"],label:"Sr. Firmware Engineer"},
  {role:"Jr. Firmware",roleKeys:["jr_fw"],label:"Jr. Firmware Engineer"},
  {role:"Industrial Design",roleKeys:["ind_design"],label:"Industrial Design"},
  {role:"Tester",roleKeys:["tester"],label:"Tester"},
  {role:"Soldering & Testing",roleKeys:["soldering"],label:"Soldering & Testing"},
  {role:"Solution Architects",roleKeys:["sol_arch"],label:"Solution Architects"},
  {role:"DevOps",roleKeys:["devops"],label:"DevOps"},
  {role:"Supply Chain",roleKeys:["sc"],label:"Supply Chain"},
];

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

export const applyTheme=(isDark)=>{
  const vars=isDark?DARK:LIGHT;
  Object.entries(vars).forEach(([k,v])=>document.documentElement.style.setProperty(k,v));
};

/* ─── HELPERS ──────────────────────────────────────────────────*/
export const todayStr=()=>new Date().toISOString().slice(0,10);
export const daysLeft=(d)=>Math.ceil((new Date(d)-new Date())/86400000);
export const ragColor=(r)=>r==="green"?"var(--green)":r==="red"?"var(--red)":"var(--amber)";
export const fmtDate=(d)=>d?new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}):"—";
export const fmtShort=(d)=>d?new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short"}):"—";
export const UNIQ=()=>Math.random().toString(36).slice(2,9);
export const initials=(name)=>name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
export const avColors=["#00c8ff","#ff6b35","#00e096","#ffb830","#c678ff","#ff3d5a","#4ecdc4","#f7b731","#a29bfe","#fd79a8","#26de81","#fd9644"];

export const getUser=(id,users)=>users.find(x=>x.id===id);
export const nonAdmins=(users)=>users.filter(u=>u.role!=="superadmin");
export const userCap=(u)=>u?.maxProjects||RESOURCE_ROLES.find(r=>r.key===u?.resourceRole)?.maxProjects||2;
export const activeProjs=(uid,projects,onDate=todayStr())=>projects.filter(p=>p.teamAssignments?.some(a=>a.userId===uid&&a.startDate<=onDate&&(a.endDate||"9999")>=onDate));
export const getPM=(p,users)=>{const a=p.teamAssignments?.find(x=>["PM","Junior PM","Project Manager"].some(r=>x.role.includes(r))&&x.userId!==1);return a?getUser(a.userId,users):null;};
export const eligibleForTag=(users,tag)=>users.filter(u=>!tag||(u.projectTags||[]).includes(tag));

/* ─── HALF-MONTH COHORTS ───────────────────────────────────────*/
export const getHalfMonths=(fromDate,count=6)=>{
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

/* ─── GLOBAL STYLES ────────────────────────────────────────────*/
export const G=({isDark})=>(
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

export const WALL_STYLES={
  none:{},
  grid:{backgroundImage:"repeating-linear-gradient(0deg,var(--bdr) 0,var(--bdr) 1px,transparent 1px,transparent 40px),repeating-linear-gradient(90deg,var(--bdr) 0,var(--bdr) 1px,transparent 1px,transparent 40px)"},
  dots:{backgroundImage:"radial-gradient(circle,var(--bdr2) 1px,transparent 1px)",backgroundSize:"24px 24px"},
  diagonal:{backgroundImage:"repeating-linear-gradient(45deg,var(--bdr) 0,var(--bdr) 1px,transparent 0,transparent 50%)",backgroundSize:"10px 10px"},
  blue:{backgroundImage:"radial-gradient(ellipse at 50% 0%,var(--acc)20,transparent 70%)"},
  green:{backgroundImage:"radial-gradient(ellipse at 50% 0%,var(--green)18,transparent 70%)"},
  purple:{backgroundImage:"radial-gradient(ellipse at 50% 0%,var(--purple)18,transparent 70%)"},
};
