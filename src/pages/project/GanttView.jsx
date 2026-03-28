import { useState } from "react";
import { CHECKLIST_DEFS, RESOURCE_ROLES, getUser, fmtDate, initials, todayStr } from "../../lib/constants.jsx";

const GanttView=({project,users})=>{
  const [viewFrom,setViewFrom]=useState(project.startDate||"");
  const [viewTo,setViewTo]=useState(project.endDate||"");
  const [filterCL,setFilterCL]=useState("all");

  const rawStart=viewFrom||project.startDate;
  const rawEnd=viewTo||project.endDate||"2025-12-31";
  const start=new Date(rawStart),end=new Date(rawEnd);
  const total=Math.max(1,(end-start)/86400000);
  const todayPct=Math.min(100,Math.max(0,((new Date()-start)/86400000/total)*100));
  const months=[];const s2=new Date(start);s2.setDate(1);while(s2<=end){months.push({label:s2.toLocaleDateString("en-IN",{month:"short",year:"2-digit"}),pct:Math.max(0,Math.min(97,((s2-start)/86400000/total)*100))});s2.setMonth(s2.getMonth()+1);}
  const pctOf=(d)=>Math.min(100,Math.max(0,((new Date(d)-start)/86400000/total)*100));
  const lenOf=(s,e2)=>Math.max(0.5,((new Date(e2)-new Date(s))/86400000/total)*100);

  const clRows=CHECKLIST_DEFS.filter(d=>d.key!=="gantt"&&d.key!=="production").map(def=>{
    const inst=project.checklists?.[def.key]||{};
    const items=(inst.items||[]).filter(it=>it.startDate&&it.endDate);
    return{def,items};
  });
  const customClRows=Object.entries(project.customChecklists||{}).filter(([k,v])=>v.baseKey!=="production").map(([clKey,cl])=>{
    const baseDef=CHECKLIST_DEFS.find(d=>d.key===cl.baseKey)||CHECKLIST_DEFS[2];
    const namedDef={...baseDef,key:clKey,label:cl.label||baseDef.label,icon:cl.icon||baseDef.icon};
    const items=(cl.items||[]).filter(it=>it.startDate&&it.endDate);
    return{def:namedDef,items};
  });
  const allClRows=customClRows.length>0?customClRows:clRows;
  const filteredClRows=filterCL==="all"?allClRows:allClRows.filter(r=>r.def.key===filterCL);

  const byAssignee=(items)=>{
    const map={};
    items.forEach(it=>{const k=it.assigneeId||"__none";if(!map[k])map[k]=[];map[k].push(it);});
    return Object.entries(map);
  };
  const prodRuns=(project.checklists?.production||[]).flatMap((prod,ri)=>(prod.items||[]).filter(it=>it.startDate&&it.endDate).map(it=>({...it,runLabel:"Prod Run "+(ri+1)})));

  const GBar=({s,e2,color,label,thin,dotted})=>{
    const left=pctOf(s);const w=lenOf(s,e2);
    const borderStyle=dotted?"1.5px dashed "+color+"99":"none";
    const titleText=label+"  "+fmtDate(s)+" → "+fmtDate(e2);
    return(<div style={{position:"absolute",left:left+"%",width:Math.max(w,0.8)+"%",top:thin?5:2,height:thin?7:14,borderRadius:3,background:dotted?"transparent":color,opacity:dotted?1:0.85,border:borderStyle,display:"flex",alignItems:"center",overflow:"hidden",boxSizing:"border-box"}} title={titleText}>
      {!thin&&!dotted&&w>10&&<span style={{fontSize:8,color:"#fff",paddingLeft:4,fontFamily:"IBM Plex Mono",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{label}</span>}
    </div>);
  };
  const GRow=({label,color,children,sub,av})=>(
    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
      <div style={{width:152,flexShrink:0,display:"flex",alignItems:"center",gap:4,justifyContent:"flex-end",paddingRight:4}}>
        {av&&<div style={{width:14,height:14,borderRadius:"50%",background:color||"var(--acc)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,color:"#fff",fontWeight:700,flexShrink:0}}>{av}</div>}
        <span style={{fontSize:sub?9:10,color:color||"var(--txt2)",fontFamily:sub&&!av?"Manrope":"IBM Plex Mono",fontStyle:sub&&!av?"italic":"normal",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:130}} title={label}>{label}</span>
      </div>
      <div style={{flex:1,position:"relative",height:18}}>
        <div style={{position:"absolute",inset:0,background:"var(--bdr)",borderRadius:3,opacity:0.3}}/>
        {children}
        <div style={{position:"absolute",left:todayPct+"%",top:-2,bottom:-2,width:1.5,background:"var(--red)",opacity:0.85}}/>
      </div>
    </div>
  );
  const SecLabel=({t})=><div style={{fontSize:9,color:"var(--txt3)",fontFamily:"IBM Plex Mono",marginBottom:4,marginTop:10,fontWeight:700,letterSpacing:"0.08em",paddingLeft:158}}>{t}</div>;

  const presets=[
    {label:"Full",from:project.startDate,to:project.endDate},
    {label:"This Month",from:(()=>{const d=new Date();d.setDate(1);return d.toISOString().slice(0,10);})(),to:(()=>{const d=new Date();d.setMonth(d.getMonth()+1,0);return d.toISOString().slice(0,10);})()},
    {label:"Next 30d",from:todayStr(),to:(()=>{const d=new Date();d.setDate(d.getDate()+30);return d.toISOString().slice(0,10);})()},
    {label:"Next 90d",from:todayStr(),to:(()=>{const d=new Date();d.setDate(d.getDate()+90);return d.toISOString().slice(0,10);})()},
    {label:"Q1",from:rawStart.slice(0,4)+"-01-01",to:rawStart.slice(0,4)+"-03-31"},
    {label:"Q2",from:rawStart.slice(0,4)+"-04-01",to:rawStart.slice(0,4)+"-06-30"},
    {label:"Q3",from:rawStart.slice(0,4)+"-07-01",to:rawStart.slice(0,4)+"-09-30"},
    {label:"Q4",from:rawStart.slice(0,4)+"-10-01",to:rawStart.slice(0,4)+"-12-31"},
  ];

  return(
    <div style={{background:"var(--s2)",borderRadius:10,padding:18,overflow:"auto",minWidth:600}}>
      <div style={{display:"flex",gap:10,alignItems:"flex-end",marginBottom:14,flexWrap:"wrap",padding:"10px 12px",background:"var(--bg)",borderRadius:8,border:"1px solid var(--bdr)"}}>
        <div>
          <div style={{fontSize:9,fontWeight:700,color:"var(--txt3)",fontFamily:"IBM Plex Mono",textTransform:"uppercase",marginBottom:4}}>From</div>
          <input type="date" value={viewFrom} onChange={e=>setViewFrom(e.target.value)} style={{background:"var(--s2)",border:"1px solid var(--bdr)",borderRadius:5,color:"var(--txt)",padding:"4px 7px",fontSize:11,outline:"none",fontFamily:"Manrope"}}/>
        </div>
        <div>
          <div style={{fontSize:9,fontWeight:700,color:"var(--txt3)",fontFamily:"IBM Plex Mono",textTransform:"uppercase",marginBottom:4}}>To</div>
          <input type="date" value={viewTo} onChange={e=>setViewTo(e.target.value)} style={{background:"var(--s2)",border:"1px solid var(--bdr)",borderRadius:5,color:"var(--txt)",padding:"4px 7px",fontSize:11,outline:"none",fontFamily:"Manrope"}}/>
        </div>
        <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"flex-end",paddingBottom:1}}>
          {presets.map(p=>(
            <button key={p.label} onClick={()=>{setViewFrom(p.from||"");setViewTo(p.to||"");}}
              style={{padding:"4px 9px",borderRadius:5,border:"1px solid var(--bdr)",background:viewFrom===p.from&&viewTo===p.to?"var(--acc)18":"transparent",color:viewFrom===p.from&&viewTo===p.to?"var(--acc)":"var(--txt3)",fontSize:10,cursor:"pointer",fontWeight:600}}>
              {p.label}
            </button>
          ))}
        </div>
        <div style={{marginLeft:"auto"}}>
          <div style={{fontSize:9,fontWeight:700,color:"var(--txt3)",fontFamily:"IBM Plex Mono",textTransform:"uppercase",marginBottom:4}}>Checklist</div>
          <select value={filterCL} onChange={e=>setFilterCL(e.target.value)} style={{background:"var(--s2)",border:"1px solid var(--bdr)",borderRadius:5,color:"var(--txt)",padding:"4px 7px",fontSize:11,outline:"none",fontFamily:"Manrope"}}>
            <option value="all">All Checklists</option>
            {allClRows.map(({def})=><option key={def.key} value={def.key}>{def.icon} {def.label}</option>)}
          </select>
        </div>
      </div>

      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--txt3)",fontFamily:"IBM Plex Mono",marginBottom:6}}>
        <span>{fmtDate(rawStart)}</span><span style={{color:"var(--red)",fontWeight:700}}>▼ Today</span><span>{fmtDate(rawEnd)}</span>
      </div>
      <div style={{position:"relative",height:14,marginBottom:10,marginLeft:158}}>
        {months.map((m,i)=><span key={i} style={{position:"absolute",left:m.pct+"%",fontSize:9,color:"var(--txt3)",fontFamily:"IBM Plex Mono",transform:"translateX(-50%)"}}>{m.label}</span>)}
      </div>

      <SecLabel t="TEAM OVERVIEW"/>
      {(project.teamAssignments||[]).map((a,i)=>{
        const u=getUser(a.userId,users||[]);if(!u)return null;
        const ri=RESOURCE_ROLES.find(r=>r.key===u.resourceRole);
        return(<GRow key={i} label={u.name} color={ri?.color} av={initials(u.name)}>
          <GBar s={a.startDate||rawStart} e2={a.endDate||rawEnd} color={ri?.color||"var(--acc)"} label={a.role}/>
        </GRow>);
      })}

      <SecLabel t={"CHECKLISTS"+(filterCL!=="all"?" — FILTERED":"")}/>
      {filteredClRows.map(({def,items})=>{
        if(!items.length){
          return(<GRow key={def.key} label={def.label} color={def.color}>
            <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",paddingLeft:8}}><span style={{fontSize:9,color:"var(--txt3)"}}>No tasks with dates yet</span></div>
          </GRow>);
        }
        const earliest=items.reduce((m,it)=>it.startDate<m?it.startDate:m,items[0].startDate);
        const latest=items.reduce((m,it)=>(it.endDate||"")>m?it.endDate:m,items[0].endDate||"");
        const groups=byAssignee(items);
        return(
          <div key={def.key}>
            <GRow label={def.label} color={def.color}>
              <GBar s={earliest} e2={latest} color={def.color} label={def.label}/>
            </GRow>
            {groups.map(([uid,tasks])=>{
              const person=uid==="__none"?null:getUser(Number(uid),users||[]);
              const nm=person?person.name:"Unassigned";
              const av=person?initials(person.name):null;
              const ps=tasks.reduce((m,it)=>it.startDate<m?it.startDate:m,tasks[0].startDate);
              const pe=tasks.reduce((m,it)=>(it.endDate||"")>m?it.endDate:m,tasks[0].endDate||"");
              return(<GRow key={uid} label={nm} color={person?def.color:"var(--txt3)"} sub av={av}>
                <GBar s={ps} e2={pe} color={def.color} label={nm} dotted/>
                {tasks.map(it=><GBar key={it.id} s={it.startDate} e2={it.endDate} color={def.color} label={it.text} thin/>)}
              </GRow>);
            })}
          </div>
        );
      })}

      {prodRuns.length>0&&<>
        <SecLabel t="PRODUCTION RUNS"/>
        {byAssignee(prodRuns).map(([uid,tasks])=>{
          const person=uid==="__none"?null:getUser(Number(uid),users||[]);
          const av=person?initials(person.name):null;
          return tasks.map((it,i)=><GRow key={i} label={(person?.name||"Unassigned")+" · "+it.text.slice(0,16)} color="var(--red)" sub av={av}>
            <GBar s={it.startDate} e2={it.endDate} color="var(--red)" label={it.text} thin/>
          </GRow>);
        })}
      </>}
      <div style={{marginTop:12,fontSize:9,color:"var(--txt3)",fontFamily:"IBM Plex Mono",textAlign:"right"}}>Solid = task · Dashed = person's work window · Updates live as checklist dates are filled in</div>
    </div>
  );
};

export default GanttView;
