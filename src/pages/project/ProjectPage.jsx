import { useState, useEffect } from "react";
import { RESOURCE_ROLES, CHECKLIST_DEFS, TEAM_SLOTS, CL_OWNERS, canApprove, todayStr, daysLeft, fmtDate, fmtShort, ragColor, tagLabel, tagColor, getUser, initials, UNIQ, mkItem, genProdItems } from "../../lib/constants.jsx";
import { fetchNotifications, markNotificationsSeen, markNotificationSeenById, fetchCommunications } from "../../lib/db.js";
import { supabase } from "../../lib/supabase.js";
import { Btn, Inp, Sel, TA, Lbl, Card, Pill, Tag, Bar, Modal, Toast, Av, SH, Divider } from "../../components/ui/index.jsx";
import ChecklistPage from "../checklist/ChecklistPage.jsx";
import GanttView from "./GanttView.jsx";
import CommSection from "./CommSection.jsx";

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

const ProjectPage=({project,currentUser,onBack,onUpdateProject,allProjects,setProjects,users,onOpenNewProject})=>{
  const [dbNotifs,setDbNotifs]=useState([]);
  const [dbComms,setDbComms]=useState(project?.communications||[]);
  useEffect(()=>{
    if(!project?.id||!currentUser?.id)return;
    fetchNotifications(project.id,currentUser.id).then(({data})=>setDbNotifs(data||[]));
    fetchCommunications(project.id).then(({data})=>{if(data)setDbComms(data.map(c=>({...c,ecnNum:c.ecn_num,authorId:c.author_id,authorName:c.users?.name||"Unknown",timestamp:c.created_at})));});
  },[project?.id,currentUser?.id]);
  const markNotifsSeen=async()=>{
    await markNotificationsSeen(project.id,currentUser.id);
    setDbNotifs(prev=>prev.map(n=>({...n,seen:true})));
  };
  const [tab,setTab]=useState("details");
  const [openCL,setOpenCL]=useState(null);
  const [showProd,setShowProd]=useState(false);
  const [showManageCL,setShowManageCL]=useState(false);
  const [editingCLKey,setEditingCLKey]=useState(null);
  const [editDesc,setEditDesc]=useState(false);
  const [desc,setDesc]=useState(project.description||"");
  const [editTeam,setEditTeam]=useState(false);
  const [teamDraft,setTeamDraft]=useState(project.teamAssignments||[]);
  const [editSheet,setEditSheet]=useState(false);
  const [sheetDraft,setSheetDraft]=useState({projectId:project.projectId,clientName:project.clientName||"",clientId:project.clientId||"",projectTag:project.projectTag,productIds:project.productIds||[project.productId||""]});
  const [showReminder,setShowReminder]=useState(false);
  const [showNotifs,setShowNotifs]=useState(false);
  const [toast,setToast]=useState(null);
  const isAdmin=currentUser.role==="superadmin";
  const isPM=currentUser.role==="pm"||isAdmin;
  const showToast=(msg,color)=>{setToast({msg,color});setTimeout(()=>setToast(null),2600);};
  const upd=(updated)=>onUpdateProject(updated);

  const saveCL=(def,idx,data,isCustom,customKey)=>{
    const cl={...(project.checklists||{})};
    if(isCustom&&customKey){
      const cc={...(project.customChecklists||{})};
      cc[customKey]={...cc[customKey],...data};
      upd({...project,customChecklists:cc});
    } else {
      if(def.multi){const arr=[...(cl.production||[])];arr[idx]={...arr[idx],...data};cl.production=arr;}
      else cl[def.key]={...(cl[def.key]||{}),...data};
      upd({...project,checklists:cl});
    }
  };
  const addProdCL=(data)=>{const cl={...(project.checklists||{})};cl.production=[...(cl.production||[]),data];upd({...project,checklists:cl});showToast("Production run created 🏭","var(--amber)");};

  if(openCL){
    if(openCL.custom){
      const customKey=openCL.def;
      const ccInst=(project.customChecklists||{})[customKey]||{};
      const baseKey=ccInst.baseKey||"hw_design";
      const baseDef=CHECKLIST_DEFS.find(d=>d.key===baseKey)||CHECKLIST_DEFS[2];
      const namedDef={...baseDef,key:customKey,label:ccInst.label||baseDef.label,icon:ccInst.icon||baseDef.icon};
      const renameCustomCL=(newLabel)=>{
        const cc={...(project.customChecklists||{})};
        cc[customKey]={...cc[customKey],label:newLabel};
        upd({...project,customChecklists:cc});
      };
      return <ChecklistPage def={namedDef} instance={ccInst} isGantt={false} project={project} currentUser={currentUser} users={users} onBack={()=>setOpenCL(null)} onSave={(data)=>saveCL(namedDef,null,data,true,customKey)} onRenameChecklist={renameCustomCL}/>;
    }
    const def=CHECKLIST_DEFS.find(d=>d.key===openCL.def);
    const instance=def.multi?(project.checklists?.production||[])[openCL.idx]:(project.checklists?.[def.key]||{});
    return <ChecklistPage def={def} instance={instance} isGantt={def.key==="gantt"} project={project} currentUser={currentUser} users={users} onBack={()=>setOpenCL(null)} onSave={(data)=>saveCL(def,def.multi?openCL.idx:null,data,false,null)} onRenameChecklist={null}/>;
  }

  const dl=daysLeft(project.endDate);
  const auditC={"Not Reviewed":"var(--txt3)",Approved:"var(--green)",Rejected:"var(--red)","In Review":"var(--amber)"};
  const pmHasActivity=(project.checklists?.pm_milestone?.items||[]).length>0||
    Object.values(project.customChecklists||{}).some(cl=>cl.baseKey==="pm_milestone"&&(cl.items||[]).length>0);
  const ganttReady=!!(project.startDate&&project.endDate);

  const CLCard=({def,locked,onClick})=>{
    const inst=project.checklists?.[def.key]||{};const items_=inst.items||[];
    const done_=items_.filter(x=>x.tmApproval==="Approved"&&x.pmApproval==="Approved"&&x.clientApproval==="Approved").length;
    const pct_=items_.length?Math.round((done_/items_.length)*100):0;
    const aColor={"Not Reviewed":"var(--txt3)",Approved:"var(--green)",Rejected:"var(--red)","In Review":"var(--amber)"}[inst.auditStatus||"Not Reviewed"];
    return(
      <div onClick={locked?undefined:onClick} className="card" style={{padding:14,cursor:locked?"default":"pointer",border:`1px solid ${items_.length?def.color+"30":"var(--bdr)"}`,opacity:locked?0.45:1,transition:"all .15s"}} onMouseEnter={e=>{if(!locked){e.currentTarget.style.background="var(--s2)";}}} onMouseLeave={e=>{e.currentTarget.style.background="var(--card)";}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
          <div style={{width:32,height:32,borderRadius:7,background:`${def.color}18`,border:`1px solid ${def.color}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{locked?"🔒":def.icon}</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:12,color:"var(--txt)"}}>{def.label}</div>
            <div style={{fontSize:10,color:"var(--txt3)"}}>{locked?"Locked":"" }{items_.length?`${done_}/${items_.length} fully approved`:" Not started"}</div>
          </div>
          <span style={{color:"var(--txt3)",fontSize:13}}>›</span>
        </div>
        {items_.length?<Bar val={pct_} color={def.color} thin/>:<div style={{height:3,background:"var(--bdr)",borderRadius:99}}/>}
        <div style={{fontSize:10,color:aColor,fontWeight:600,marginTop:8,textTransform:"uppercase",letterSpacing:"0.03em"}}>Audit: {inst.auditStatus||"Not Reviewed"}</div>
      </div>
    );
  };

  return(
    <div style={{flex:1,overflow:"auto",display:"flex",flexDirection:"column"}}>
      <div style={{background:"var(--s1)",borderBottom:"1px solid var(--bdr)",padding:"10px 22px",display:"flex",alignItems:"center",gap:10,flexShrink:0,flexWrap:"wrap"}}>
        <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",color:"var(--txt2)",display:"flex",alignItems:"center",gap:5,padding:0}}><span style={{fontSize:17}}>←</span><span style={{fontSize:12}}>Projects</span></button>
        <span style={{color:"var(--bdr2)"}}>›</span>
        <span style={{fontWeight:800,fontSize:14,color:"var(--txt)"}}>{project.name}</span>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <Tag label={project.projectId} color="var(--txt2)"/>
          {project.projectTag&&<Tag label={tagLabel(project.projectTag)} color={tagColor(project.projectTag)}/>}
          <Pill label={(project.rag||"amber").charAt(0).toUpperCase()+(project.rag||"amber").slice(1)} color={ragColor(project.rag||"amber")} small/>
          {project.sanctioned&&<Pill label="Sanctioned ✓" color="var(--green)" small/>}
          {project.pendingSanction&&!project.sanctioned&&<Pill label="⏳ Pending Sanction" color="var(--amber)" small/>}
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:6,alignItems:"center"}}>
          {isPM&&(()=>{
            const pendingRevs=(dbNotifs||[]).filter(n=>n.type==="review_request"&&!n.seen);
            const totalRevs=(dbNotifs||[]).filter(n=>n.type==="review_request").length;
            if(totalRevs===0)return null;
            return(<button onClick={()=>setShowNotifs(true)} style={{padding:"4px 10px",borderRadius:7,border:`1px solid ${pendingRevs.length?"var(--amber)40":"var(--bdr)"}`,background:pendingRevs.length?"var(--amber)12":"transparent",cursor:"pointer",color:pendingRevs.length?"var(--amber)":"var(--txt3)",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",gap:5}}>
              🔔{pendingRevs.length>0&&<span>{pendingRevs.length} Pending</span>}
            </button>);
          })()}
          <Btn v="ghost" style={{fontSize:10,padding:"4px 10px"}} onClick={()=>setShowReminder(true)}>📨 Remind</Btn>
          {isAdmin&&<Btn v="danger" style={{fontSize:10,padding:"4px 10px"}} onClick={()=>{
            if(window.confirm("Delete \""+project.name+"\"?\n\nThis will permanently remove the project and all its checklists. This cannot be undone.")){
              setProjects(ps=>ps.filter(p=>p.id!==project.id));
              onBack();
            }
          }}>🗑 Delete Project</Btn>}
        </div>
      </div>
      <div style={{background:"var(--s1)",borderBottom:"1px solid var(--bdr)",padding:"0 22px",display:"flex"}}>
        {[{id:"details",l:"Project Details"},{id:"execution",l:"Execution"},{id:"comms",l:"Client Communication"}].map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"9px 14px",background:"none",border:"none",cursor:"pointer",fontSize:14,fontWeight:500,color:tab===t.id?"#2563eb":"#64748b",borderBottom:`2px solid ${tab===t.id?"#2563eb":"transparent"}`,transition:"all .15s",marginBottom:-1}}>{t.l}</button>)}
      </div>

      <div style={{flex:1,overflow:"auto",padding:22}}>
        {tab==="details"&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 360px",gap:22}}>
            <div>
              {(()=>{
                const saveSheet=()=>{upd({...project,...sheetDraft,productId:sheetDraft.productIds[0]||""});setEditSheet(false);showToast("Internal sheet updated ✓","var(--green)");};
                const addPid=()=>setSheetDraft(d=>({...d,productIds:[...d.productIds,""]}));
                const setPid=(i,v)=>setSheetDraft(d=>({...d,productIds:d.productIds.map((p,idx)=>idx===i?v:p)}));
                const rmPid=(i)=>setSheetDraft(d=>({...d,productIds:d.productIds.filter((_,idx)=>idx!==i)}));
                return(
                  <div style={{padding:"14px 16px",background:"var(--s2)",border:"1px solid var(--bdr2)",borderRadius:10,marginBottom:18}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                      <div style={{fontSize:12,fontWeight:500,color:"var(--acc)",textTransform:"uppercase",letterSpacing:"0.04em"}}>📋 Project Internal Sheet</div>
                      {isAdmin&&<Btn v="ghost" style={{fontSize:10,padding:"3px 9px"}} onClick={()=>{if(!editSheet)setSheetDraft({projectId:project.projectId,clientName:project.clientName||"",clientId:project.clientId||"",projectTag:project.projectTag,productIds:project.productIds||[project.productId||""]});setEditSheet(!editSheet);}}>{editSheet?"Cancel":"✏ Edit"}</Btn>}
                    </div>
                    {editSheet?(
                      <div style={{display:"flex",flexDirection:"column",gap:10}}>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                          <div><Lbl>Project ID</Lbl><Inp value={sheetDraft.projectId} onChange={e=>setSheetDraft(d=>({...d,projectId:e.target.value}))}/></div>
                          <div><Lbl>Project Type</Lbl><Sel value={sheetDraft.projectTag} onChange={e=>setSheetDraft(d=>({...d,projectTag:e.target.value}))}>{[{key:"engineering",label:"Engineering Project"},{key:"elecbits_product",label:"Elecbits Product"},{key:"modifier",label:"Modifier"}].map(t=><option key={t.key} value={t.key}>{t.label}</option>)}</Sel></div>
                          <div><Lbl>Client Name</Lbl><Inp value={sheetDraft.clientName} onChange={e=>setSheetDraft(d=>({...d,clientName:e.target.value}))}/></div>
                          <div><Lbl>Client ID</Lbl><Inp value={sheetDraft.clientId} onChange={e=>setSheetDraft(d=>({...d,clientId:e.target.value}))}/></div>
                        </div>
                        <div>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><Lbl style={{marginBottom:0}}>Electronics PCB IDs</Lbl><Btn v="ghost" style={{fontSize:10,padding:"2px 8px"}} onClick={addPid}>+ Add</Btn></div>
                          {sheetDraft.productIds.map((pid,i)=><div key={i} style={{display:"flex",gap:6,marginBottom:5}}><Inp value={pid} onChange={e=>setPid(i,e.target.value)} placeholder={`PCB-${100+i}`} style={{flex:1,fontSize:11}}/>{sheetDraft.productIds.length>1&&<button onClick={()=>rmPid(i)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--red)",fontSize:14,padding:"0 4px"}}>×</button>}</div>)}
                        </div>
                        <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}><Btn v="secondary" style={{fontSize:11}} onClick={()=>setEditSheet(false)}>Cancel</Btn><Btn v="success" style={{fontSize:11}} onClick={saveSheet}>💾 Save Sheet</Btn></div>
                      </div>
                    ):(
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:12}}>
                        <div><span style={{color:"var(--txt3)"}}>Project ID: </span><span style={{fontFamily:"'IBM Plex Mono',monospace",fontWeight:700,color:"var(--txt)"}}>{project.projectId}</span></div>
                        <div><span style={{color:"var(--txt3)"}}>Client: </span><span style={{fontWeight:700,color:"var(--txt)"}}>{project.clientName||"—"}</span></div>
                        <div><span style={{color:"var(--txt3)"}}>Client ID: </span><span style={{fontFamily:"'IBM Plex Mono',monospace",color:"var(--txt)"}}>{project.clientId||"—"}</span></div>
                        <div><span style={{color:"var(--txt3)"}}>Type: </span>{project.projectTag&&<Tag label={tagLabel(project.projectTag)} color={tagColor(project.projectTag)}/>}</div>
                        <div style={{gridColumn:"span 2"}}>
                          <span style={{color:"var(--txt3)"}}>Electronics PCB IDs: </span>
                          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:4}}>
                            {(project.productIds||(project.productId?[project.productId]:[])).filter(Boolean).map((pid,i)=><Tag key={i} label={pid} color="var(--blue)"/>)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              <SH title="About" action={isPM&&<Btn v="ghost" style={{fontSize:10,padding:"3px 9px"}} onClick={()=>setEditDesc(!editDesc)}>{editDesc?"Cancel":"✏ Edit"}</Btn>}/>
              <Card style={{padding:16,marginBottom:18}}>
                {editDesc?<div><TA value={desc} onChange={e=>setDesc(e.target.value)} rows={4}/><div style={{display:"flex",gap:6,marginTop:8,justifyContent:"flex-end"}}><Btn v="secondary" style={{fontSize:11}} onClick={()=>setEditDesc(false)}>Cancel</Btn><Btn style={{fontSize:11}} onClick={()=>{upd({...project,description:desc});setEditDesc(false);showToast("Saved ✓","var(--green)");}}>Save</Btn></div></div>
                :<div style={{fontSize:13,color:project.description?"var(--txt)":"var(--txt3)",lineHeight:1.7}}>{project.description||"No description."}</div>}
              </Card>

              <SH title="Timeline"/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
                {[["Start",fmtDate(project.startDate),"var(--blue)"],["End",fmtDate(project.endDate),dl<0?"var(--red)":dl<14?"var(--amber)":"var(--green)"],["Days Left",dl<0?"OVERDUE":dl+"d",dl<0?"var(--red)":dl<14?"var(--amber)":"var(--txt)"]].map(([label,val,color])=>(
                  <div key={label} style={{padding:"12px 14px",background:"var(--s2)",borderRadius:8}}><div style={{fontSize:11,color:"var(--txt2)",marginBottom:5,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.04em"}}>{label}</div><div style={{fontSize:16,fontWeight:700,color}}>{val}</div></div>
                ))}
              </div>
            </div>

            <div>
              {isAdmin&&(()=>{
                const currentTM=(project.teamAssignments||[]).find(a=>a.role==="Senior PM");
                const currentTMUser=currentTM?getUser(currentTM.userId,users):null;
                const assignedUserIds=(project.teamAssignments||[]).map(a=>a.userId).filter(Boolean);
                const eligibleTMs=(users||[]).filter(u=>assignedUserIds.includes(u.id));
                return(
                  <div style={{padding:"10px 14px",background:"var(--coral)08",border:"1px solid var(--coral)25",borderRadius:9,marginBottom:12}}>
                    <div style={{fontSize:12,fontWeight:500,color:"var(--coral)",textTransform:"uppercase",marginBottom:8,letterSpacing:"0.04em"}}>⭐ Technical Manager (TM)</div>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                      {currentTMUser?<><Av uid={currentTMUser.id} size={26} users={users}/><span style={{fontSize:12,fontWeight:700,color:"var(--txt)"}}>{currentTMUser.name}</span><Pill label="Current TM" color="var(--coral)" small/></>:<span style={{fontSize:11,color:"var(--txt3)"}}>No TM assigned yet</span>}
                    </div>
                    <Sel defaultValue="" onChange={e=>{
                      if(!e.target.value)return;
                      const selectedUser=eligibleTMs.find(u=>String(u.id)===e.target.value);
                      if(!selectedUser)return;
                      const newTA=(project.teamAssignments||[]).filter(a=>a.role!=="Senior PM");
                      newTA.unshift({userId:selectedUser.id,role:"Senior PM",startDate:project.startDate||"",endDate:project.endDate||""});
                      upd({...project,teamAssignments:newTA});
                      showToast(`${selectedUser.name} set as TM ✓`,"var(--coral)");
                      e.target.value="";
                    }} style={{width:"100%",fontSize:11,padding:"5px 8px"}}>
                      <option value="">Change TM from assigned resources…</option>
                      {eligibleTMs.map(u=>{const aRole=(project.teamAssignments||[]).find(a=>a.userId===u.id)?.role||"Team";return <option key={u.id} value={u.id}>{u.name} ({aRole})</option>;})}
                    </Sel>
                  </div>
                );
              })()}
              {(()=>{
                const saveTeam=()=>{upd({...project,teamAssignments:teamDraft});setEditTeam(false);showToast("Team updated ✓","var(--green)");};
                const getSlotAssignment=(role)=>teamDraft.find(x=>x.role===role);
                const updateSlot=(role,field,val)=>setTeamDraft(prev=>{const exists=prev.find(x=>x.role===role);if(exists)return prev.map(x=>x.role===role?{...x,[field]:val}:x);return [...prev,{role,userId:"",startDate:project.startDate||"",endDate:project.endDate||"",[field]:val}];});
                const assignSlot=async(slotRole,userId)=>{
                  const member=userId?(users||[]).find(u=>u.id===userId):null;
                  if(!userId){
                    const{error}=await supabase.from("team_assignments").delete().eq("project_id",project.id).eq("role",slotRole);
                    if(error){showToast("Failed to unassign: "+error.message,"red");return;}
                  }else{
                    const{error}=await supabase.from("team_assignments").upsert({project_id:project.id,user_id:Number(userId),role:slotRole,start_date:project.startDate||null,end_date:project.endDate||null},{onConflict:"project_id,role"});
                    if(error){showToast("Failed to assign: "+error.message,"red");return;}
                  }
                  const newTA=(project.teamAssignments||[]).filter(a=>a.role!==slotRole);
                  if(userId)newTA.push({userId:Number(userId),role:slotRole,startDate:project.startDate||"",endDate:project.endDate||""});
                  const stamped={...project,teamAssignments:newTA,updatedAt:new Date().toISOString()};
                  setTeamDraft(newTA);
                  setProjects(prev=>prev.map(p=>p.id===stamped.id?stamped:p));
                  showToast(member?`${member.name} assigned as ${slotRole} ✓`:`${slotRole} unassigned ✓`,"var(--green)");
                };
                return(
                  <>
                    <SH title="Team & Dates" action={isPM&&<Btn v="ghost" style={{fontSize:10,padding:"3px 9px"}} onClick={()=>{setTeamDraft(project.teamAssignments||[]);setEditTeam(!editTeam);}}>{editTeam?"Cancel":"✏ Edit Team"}</Btn>}/>
                    <div style={{fontSize:11,color:"var(--txt3)",marginBottom:8}}>Role slots are fixed — you can only assign someone with the matching designation.</div>
                    {TEAM_SLOTS.map(slot=>{
                      const a=getSlotAssignment(slot.role);
                      const m=a?.userId?getUser(a.userId,users):null;
                      const eligible=(users||[]).filter(u=>slot.roleKeys.includes(u.resourceRole)&&(u.projectTags||[]).includes(project.projectTag||"engineering"));
                      return(
                        <div key={slot.role} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:m?"var(--s2)":"var(--bg)",border:"1px solid var(--bdr)",borderRadius:8,marginBottom:5,opacity:!m&&!editTeam?0.4:1}}>
                          {m?<Av uid={m.id} size={28} users={users}/>:<div style={{width:28,height:28,borderRadius:"50%",background:"var(--bdr)",border:"1px dashed var(--bdr2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"var(--txt3)",flexShrink:0}}>—</div>}
                          <div style={{flex:1}}>
                            {editTeam?(
                              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                                <div style={{fontSize:11,color:"var(--txt3)",fontWeight:500}}>{slot.label}</div>
                                <Sel value={a?.userId||""} onChange={e=>{const v=e.target.value;updateSlot(slot.role,"userId",v?Number(v):"");assignSlot(slot.role,v?Number(v):null);}} style={{padding:"4px 6px",fontSize:11}}>
                                  <option value="">— Select {slot.role} —</option>
                                  {eligible.map(u=><option key={u.id} value={u.id}>{u.name} ({RESOURCE_ROLES.find(r=>r.key===u.resourceRole)?.label})</option>)}
                                </Sel>
                                <div style={{display:"flex",gap:4}}>
                                  <Inp type="date" value={a?.startDate||""} onChange={e=>updateSlot(slot.role,"startDate",e.target.value)} style={{padding:"3px 5px",fontSize:10,flex:1}} placeholder="Start"/>
                                  <Inp type="date" value={a?.endDate||""} onChange={e=>updateSlot(slot.role,"endDate",e.target.value)} style={{padding:"3px 5px",fontSize:10,flex:1}} placeholder="End"/>
                                </div>
                              </div>
                            ):(
                              <>
                                <div style={{fontWeight:700,fontSize:12,color:m?"var(--txt)":"var(--txt3)"}}>{m?m.name:"Unassigned"}</div>
                                <div style={{fontSize:10,color:"var(--txt3)"}}>{slot.label}</div>
                              </>
                            )}
                          </div>
                          {!editTeam&&a?.userId&&<div style={{textAlign:"right"}}><div style={{fontSize:11,color:"var(--acc)"}}>{fmtShort(a.startDate)} → {fmtShort(a.endDate||project.endDate)}</div></div>}
                        </div>
                      );
                    })}
                    {editTeam&&<div style={{display:"flex",gap:8,marginTop:10,justifyContent:"flex-end"}}><Btn v="secondary" style={{fontSize:11}} onClick={()=>setEditTeam(false)}>Cancel</Btn><Btn v="success" style={{fontSize:11}} onClick={saveTeam}>💾 Save Team</Btn></div>}
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {tab==="execution"&&(
          <div>
            <div style={{padding:"10px 14px",background:"var(--s2)",borderRadius:8,fontSize:11,color:"var(--txt2)",marginBottom:12,lineHeight:1.7}}>
              <strong>Step 1:</strong> PM / Milestone checklist first &ensp;·&ensp;
              <strong>Step 2:</strong> Domain checklists unlock after PM milestone is started &ensp;·&ensp;
              <strong>Step 3:</strong> Gantt unlocks when project start+end dates are set.&ensp;
              Approval order: <strong>TM → PM → Client</strong> per task.
            </div>

            <SH title="Step 1 — PM / Milestone" color="var(--purple)"/>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:10,marginBottom:18}}>
              {!Object.keys(project.customChecklists||{}).length&&
                CHECKLIST_DEFS.filter(d=>d.key==="pm_milestone").map(def=>
                  <CLCard key={def.key} def={def} locked={false} onClick={()=>setOpenCL({def:def.key})}/>
                )
              }
              {Object.entries(project.customChecklists||{}).filter(([k,v])=>v.baseKey==="pm_milestone").map(([clKey,cl])=>{
                const def=CHECKLIST_DEFS.find(d=>d.key==="pm_milestone");
                const customDef={...def,label:cl.label,key:clKey,icon:cl.icon||def.icon};
                return <CLCard key={clKey} def={customDef} locked={false} onClick={()=>setOpenCL({def:clKey,custom:true})}/>;
              })}
            </div>

            <SH title="Step 2 — Domain Checklists" color="var(--amber)" action={!pmHasActivity&&<Pill label="🔒 Locked — start PM Milestone first" color="var(--amber)" small/>}/>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:10,marginBottom:18}}>
              {!Object.keys(project.customChecklists||{}).length&&
                CHECKLIST_DEFS.filter(d=>!["gantt","pm_milestone","production"].includes(d.key)).map(def=>
                  <CLCard key={def.key} def={def} locked={!pmHasActivity} onClick={()=>setOpenCL({def:def.key})}/>
                )
              }
              {Object.entries(project.customChecklists||{}).filter(([k,v])=>!["pm_milestone","production"].includes(v.baseKey)).map(([clKey,cl])=>{
                const def=CHECKLIST_DEFS.find(d=>d.key===cl.baseKey)||CHECKLIST_DEFS[2];
                const customDef={...def,label:cl.label,key:clKey,icon:cl.icon||def.icon,color:def?.color||"var(--amber)"};
                return <CLCard key={clKey} def={customDef} locked={!pmHasActivity} onClick={()=>setOpenCL({def:clKey,custom:true})}/>;
              })}
            </div>

            <SH title="Step 3 — Gantt Chart" color="var(--blue)" action={!ganttReady&&<Pill label="🔒 Add project start & end dates first" color="var(--blue)" small/>}/>
            <div style={{marginBottom:18}}>
              <CLCard def={CHECKLIST_DEFS.find(d=>d.key==="gantt")} locked={!ganttReady} onClick={()=>setOpenCL({def:"gantt"})}/>
            </div>

            <Divider/>
            <SH title="Production Checklists" color="var(--red)" action={isPM&&<Btn v="ghost" style={{fontSize:10,padding:"4px 10px"}} onClick={()=>setShowProd(true)}>+ New Run</Btn>}/>
            {!(project.checklists?.production||[]).length&&!Object.values(project.customChecklists||{}).some(cl=>cl.baseKey==="production")&&<div style={{textAlign:"center",padding:"14px 0",color:"var(--txt3)",fontSize:12}}>No production runs.</div>}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:10}}>
              {(project.checklists?.production||[]).map((prod,idx)=>{const done_=(prod.items||[]).filter(x=>x.tmApproval==="Approved"&&x.pmApproval==="Approved"&&x.clientApproval==="Approved").length;const pct_=prod.items?.length?Math.round((done_/prod.items.length)*100):0;return(<div key={idx} onClick={()=>setOpenCL({def:"production",idx})} className="card" style={{padding:14,cursor:"pointer",border:"1px solid var(--red)25"}} onMouseEnter={e=>e.currentTarget.style.background="var(--s2)"} onMouseLeave={e=>e.currentTarget.style.background="var(--card)"}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><div style={{width:32,height:32,borderRadius:7,background:"var(--red)18",border:"1px solid var(--red)30",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🏭</div><div style={{flex:1}}><div style={{fontWeight:700,fontSize:12,color:"var(--txt)"}}>{prod.label||`Run ${idx+1}`}</div><div style={{fontSize:10,color:"var(--txt3)"}}>{prod.units} units · {done_}/{prod.items?.length||0}</div></div><span style={{color:"var(--txt3)",fontSize:13}}>›</span></div><Bar val={pct_} color="var(--red)" thin/></div>);})}
            </div>
            {showProd&&<ProdModal onClose={()=>setShowProd(false)} onAdd={addProdCL}/>}
          </div>
        )}
        {tab==="comms"&&<div style={{maxWidth:780}}><CommSection project={project} currentUser={currentUser} isPM={isPM} isAdmin={isAdmin} dbComms={dbComms} setDbComms={setDbComms} upd={upd} showReminder={showReminder} setShowReminder={setShowReminder} showToast={showToast} onBack={onBack} onOpenNewProject={onOpenNewProject}/></div>}
      </div>
      {showReminder&&<Modal title="Send Reminder" onClose={()=>setShowReminder(false)} maxW={440}><div style={{display:"flex",flexDirection:"column",gap:12}}><div><Lbl>Send To</Lbl><Sel defaultValue="all"><option value="all">All team members</option>{(project.teamAssignments||[]).map(a=>{const u=getUser(a.userId,users);return u?<option key={a.userId} value={a.userId}>{u.name}</option>:null;})}</Sel></div><div><Lbl>Message</Lbl><TA rows={4} placeholder="Enter reminder…"/></div><div style={{display:"flex",gap:6,justifyContent:"flex-end"}}><Btn v="secondary" onClick={()=>setShowReminder(false)}>Cancel</Btn><Btn v="success" onClick={()=>{showToast("Sent 📨","var(--blue)");setShowReminder(false);}}>Send</Btn></div></div></Modal>}
      {showNotifs&&<Modal title="🔔 Review Requests" onClose={()=>{setShowNotifs(false);markNotifsSeen();}} maxW={520}>
        <div style={{marginBottom:10,fontSize:11,color:"var(--txt2)"}}>Tasks submitted for review by team members.</div>
        {(dbNotifs||[]).filter(n=>n.type==="review_request").length===0
          ?<div style={{textAlign:"center",padding:"20px 0",color:"var(--txt3)",fontSize:13}}>No review requests yet.</div>
          :(dbNotifs||[]).filter(n=>n.type==="review_request").sort((a,b)=>Number(a.seen)-Number(b.seen)).map(n=>(
          <div key={n.id} style={{padding:"12px 14px",background:n.seen?"var(--s2)":"var(--amber)06",border:`1px solid ${n.seen?"var(--bdr)":"var(--amber)30"}`,borderRadius:8,marginBottom:8}}>
            <div style={{fontWeight:700,fontSize:12,color:"var(--txt)",marginBottom:2}}>{n.taskText}</div>
            <div style={{fontSize:11,color:"var(--txt2)"}}>{n.checklist}</div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
              {!n.seen&&<Pill label="New" color="var(--amber)" small/>}
              <Btn v="ghost" style={{fontSize:10,padding:"3px 10px"}} onClick={async()=>{
                await markNotificationSeenById(n.id);
                setDbNotifs(prev=>prev.map(x=>x.id===n.id?{...x,seen:true}:x));
                const def=CHECKLIST_DEFS.find(d=>d.label===n.checklist_label||d.key===n.checklist_label);
                if(def){setOpenCL({def:def.key});}
                else{
                  const customKeys=Object.keys(project.customChecklists||{});
                  const matchKey=customKeys.find(k=>(project.customChecklists[k]?.label||k)===n.checklist_label);
                  if(matchKey)setOpenCL({def:matchKey,custom:true});
                  else showToast("Checklist no longer exists","var(--amber)");
                }
                setShowNotifs(false);
              }}>Open →</Btn>
            </div>
          </div>
        ))}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}>
          <Btn v="secondary" style={{fontSize:11}} onClick={()=>{markNotifsSeen();}}>Mark all read</Btn>
          <Btn v="ghost" style={{fontSize:11}} onClick={()=>setShowNotifs(false)}>Close</Btn>
        </div>
      </Modal>}
      {toast&&<Toast {...toast}/>}
    </div>
  );
};

export default ProjectPage;
