import { useState } from "react";
import { daysLeft, getUser } from "../lib/constants.jsx";
import { Btn, Sel, TA, Tag, Pill, Modal, Toast } from "../components/ui/index.jsx";

const AlertsView=({projects,currentUser,users})=>{
  const [filter,setFilter]=useState("All");
  const [reminderProj,setReminderProj]=useState(null);
  const [toast,setToast]=useState(null);
  const showToast=(msg,color)=>{setToast({msg,color});setTimeout(()=>setToast(null),2600);};
  const aC={critical:"var(--red)",warning:"var(--amber)",info:"var(--blue)",success:"var(--green)"};
  const allAlerts=[];
  projects.forEach(p=>{
    const dl=daysLeft(p.endDate);
    if(p.rag==="red")allAlerts.push({t:"critical",proj:p,msg:`RAG Red · ${dl}d remaining`});
    if(dl<14&&dl>0)allAlerts.push({t:"warning",proj:p,msg:`Deadline in ${dl}d`});
    if((p.communications||[]).some(c=>c.type==="major"&&c.status==="pending_approval"))allAlerts.push({t:"critical",proj:p,msg:"Major change awaiting Super Admin approval"});
    if(p.pendingSanction&&!p.sanctioned)allAlerts.push({t:"info",proj:p,msg:"Submitted for sanction — awaiting approval"});
    if(p.rag==="green"&&!p.pendingSanction)allAlerts.push({t:"success",proj:p,msg:"On track"});
  });
  const filtered=filter==="All"?allAlerts:allAlerts.filter(a=>a.t===filter);
  const grouped={};filtered.forEach(a=>{const k=a.proj?.id||"__g";if(!grouped[k])grouped[k]={proj:a.proj,alerts:[]};grouped[k].alerts.push(a);});
  return(
    <div>
      <div style={{padding:"8px 12px",background:"var(--s2)",borderRadius:7,fontSize:11,color:"var(--txt2)",marginBottom:14}}>⏰ <strong>Auto-notifications:</strong> If a sanctioned project task is overdue, the PM receives a notification within 30 minutes.</div>
      <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>{["All","critical","warning","info","success"].map(f=><Btn key={f} v={filter===f?"primary":"secondary"} style={{fontSize:10,padding:"4px 10px"}} onClick={()=>setFilter(f)}>{f.charAt(0).toUpperCase()+f.slice(1)}</Btn>)}</div>
      {Object.values(grouped).map((group,gi)=>(
        <div key={gi} style={{marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>{group.proj?<><span style={{fontWeight:700,fontSize:13,color:"var(--txt)"}}>{group.proj.name}</span><Tag label={group.proj.projectId} color="var(--txt2)"/></>:<span style={{fontWeight:700,fontSize:13,color:"var(--txt2)"}}>Global</span>}</div>
            {group.proj&&<Btn v="ghost" style={{fontSize:10,padding:"3px 9px"}} onClick={()=>setReminderProj(group.proj)}>📨 Remind</Btn>}
          </div>
          {group.alerts.map((a,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"var(--s2)",border:`1px solid ${aC[a.t]}22`,borderRadius:7,padding:"9px 12px",marginBottom:4}}><div style={{display:"flex",gap:8,alignItems:"flex-start"}}><div style={{width:7,height:7,borderRadius:"50%",background:aC[a.t],flexShrink:0,marginTop:3}}/><div><div style={{fontSize:9,color:aC[a.t],fontWeight:700,fontFamily:"IBM Plex Mono",marginBottom:2}}>{a.t.toUpperCase()}</div><div style={{fontSize:12,color:"var(--txt)"}}>{a.msg}</div></div></div></div>)}
        </div>
      ))}
      {filtered.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:"var(--txt3)"}}>No alerts.</div>}
      {reminderProj&&<Modal title={`Remind — ${reminderProj?.name}`} onClose={()=>setReminderProj(null)} maxW={440}><div style={{display:"flex",flexDirection:"column",gap:12}}><Sel defaultValue="all"><option value="all">All team members</option>{(reminderProj?.teamAssignments||[]).map(a=>{const u=getUser(a.userId,users);return u?<option key={a.userId} value={a.userId}>{u.name}</option>:null;})}</Sel><TA rows={3} placeholder="Message…"/><div style={{display:"flex",gap:6,justifyContent:"flex-end"}}><Btn v="secondary" onClick={()=>setReminderProj(null)}>Cancel</Btn><Btn v="success" onClick={()=>{showToast("Sent 📨","var(--blue)");setReminderProj(null);}}>Send</Btn></div></div></Modal>}
      {toast&&<Toast {...toast}/>}
    </div>
  );
};

export default AlertsView;
