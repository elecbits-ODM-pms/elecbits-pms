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
          <div style={{display:"grid",gridTemplateColumns:"1fr 420px",gap:22}}>
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

            <div style={{minWidth:0,overflow:"hidden"}}>
              {isAdmin&&(()=>{
                const currentTM=(project.teamAssignments||[]).find(a=>a.role==="Senior PM");
                const currentTMUser=currentTM?getUser(currentTM.userId,users):null;
                const assignedUserIds=(project.teamAssignments||[]).map(a=>a.userId).filter(Boolean);
                const eligibleTMs=(users||[]).filter(u=>assignedUserIds.includes(u.id));
                return(
                  <div style={{background:"var(--card)",border:"1px solid #e2e8f0",borderRadius:12,boxShadow:"0 1px 4px rgba(0,0,0,0.06)",padding:"16px 18px",marginBottom:14}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12}}>
                      <span style={{fontSize:16}}>&#9733;</span>
                      <span style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.06em"}}>Technical Manager</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12,padding:"10px 14px",background:"#f8fafc",borderRadius:10}}>
                      {currentTMUser?(
                        <>
                          <div style={{width:44,height:44,borderRadius:"50%",background:"linear-gradient(135deg,#ea580c,#f97316)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:15,flexShrink:0}}>{initials(currentTMUser.name)}</div>
                          <div style={{flex:1}}>
                            <div style={{fontWeight:700,fontSize:14,color:"var(--txt)"}}>{currentTMUser.name}</div>
                            <div style={{fontSize:11,color:"var(--txt2)"}}>Technical Manager</div>
                          </div>
                          <span style={{padding:"3px 10px",borderRadius:99,background:"#16a34a18",color:"#16a34a",fontSize:10,fontWeight:700,border:"1px solid #16a34a30"}}>Current TM</span>
                        </>
                      ):(
                        <div style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
                          <div style={{width:44,height:44,borderRadius:"50%",background:"#e2e8f0",display:"flex",alignItems:"center",justifyContent:"center",color:"#94a3b8",fontSize:18,flexShrink:0}}>?</div>
                          <span style={{fontSize:13,color:"#94a3b8",fontWeight:500}}>No TM assigned yet</span>
                        </div>
                      )}
                    </div>
                    <Sel defaultValue="" onChange={e=>{
                      if(!e.target.value)return;
                      const selectedUser=eligibleTMs.find(u=>String(u.id)===e.target.value);
                      if(!selectedUser)return;
                      const newTA=(project.teamAssignments||[]).filter(a=>a.role!=="Senior PM");
                      newTA.unshift({userId:selectedUser.id,role:"Senior PM",startDate:project.startDate||"",endDate:project.endDate||""});
                      upd({...project,teamAssignments:newTA});
                      showToast(`${selectedUser.name} set as TM`,"var(--green)");
                      e.target.value="";
                    }} style={{width:"100%",fontSize:11,padding:"7px 10px",borderRadius:8,border:"1px solid #e2e8f0",background:"#fff"}}>
                      <option value="">Change TM from assigned resources...</option>
                      {eligibleTMs.map(u=>{const aRole=(project.teamAssignments||[]).find(a=>a.userId===u.id)?.role||"Team";return <option key={u.id} value={u.id}>{u.name} ({aRole})</option>;})}
                    </Sel>
                  </div>
                );
              })()}
              {(()=>{
                const saveTeam=()=>{upd({...project,teamAssignments:teamDraft});setEditTeam(false);showToast("Team updated","var(--green)");};
                const getSlotAssignment=(role)=>teamDraft.find(x=>x.role===role);
                const updateSlot=(role,field,val)=>setTeamDraft(prev=>{const exists=prev.find(x=>x.role===role);if(exists)return prev.map(x=>x.role===role?{...x,[field]:val}:x);return [...prev,{role,userId:"",startDate:project.startDate||"",endDate:project.endDate||"",[field]:val}];});
                const assignSlot=async(slotRole,userId)=>{
                  const member=userId?(users||[]).find(u=>u.id===userId):null;
                  const{error:delErr}=await supabase.from("team_assignments").delete().eq("project_id",project.id).eq("role",slotRole);
                  if(delErr){showToast("Failed: "+delErr.message,"red");return;}
                  if(userId){
                    const{error:insErr}=await supabase.from("team_assignments").insert({project_id:project.id,user_id:userId,role:slotRole,start_date:project.startDate||null,end_date:project.endDate||null});
                    if(insErr){showToast("Failed: "+insErr.message,"red");return;}
                  }
                  const newTA=(project.teamAssignments||[]).filter(a=>a.role!==slotRole);
                  if(userId)newTA.push({userId,role:slotRole,startDate:project.startDate||"",endDate:project.endDate||""});
                  const stamped={...project,teamAssignments:newTA,updatedAt:new Date().toISOString()};
                  setTeamDraft(newTA);
                  setProjects(prev=>prev.map(p=>p.id===stamped.id?stamped:p));
                  showToast(member?`${member.name} assigned as ${slotRole}`:`${slotRole} unassigned`,"var(--green)");
                };
                const slotAvatarColor=(slot)=>{
                  if(["Senior PM","PM"].includes(slot.role))return "#6366f1";
                  if(["Sr. Hardware","Jr. Hardware"].includes(slot.role))return "#2563eb";
                  if(["Sr. Firmware","Jr. Firmware"].includes(slot.role))return "#16a34a";
                  return "#64748b";
                };
                return(
                  <>
                    <div style={{background:"var(--card)",border:"1px solid #e2e8f0",borderRadius:12,boxShadow:"0 1px 4px rgba(0,0,0,0.06)",padding:"16px 18px",marginBottom:14}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.06em"}}>Team Roster</span>
                          <span style={{padding:"2px 8px",borderRadius:99,background:"#6366f118",color:"#6366f1",fontSize:10,fontWeight:700}}>{(project.teamAssignments||[]).filter(a=>a.userId).length} assigned</span>
                        </div>
                        {isPM&&<Btn v="ghost" style={{fontSize:10,padding:"4px 10px",borderRadius:6}} onClick={()=>{setTeamDraft(project.teamAssignments||[]);setEditTeam(!editTeam);}}>{editTeam?"Cancel":"Edit Team"}</Btn>}
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                        {TEAM_SLOTS.map(slot=>{
                          const a=getSlotAssignment(slot.role);
                          const m=a?.userId?getUser(a.userId,users):null;
                          const roleMatch=(users||[]).filter(u=>u.name&&slot.roleKeys.includes(u.resourceRole));
                          const eligible=roleMatch.length>0?roleMatch:(users||[]).filter(u=>u.name);
                          const bgColor=slotAvatarColor(slot);
                          return(
                            <div key={slot.role} style={{padding:12,background:"#f8fafc",borderRadius:10,border:"1px solid #e2e8f0",position:"relative",opacity:!m&&!editTeam?0.45:1,transition:"opacity .15s"}}>
                              <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:8}}>{slot.role}</div>
                              {editTeam?(
                                <div style={{display:"flex",flexDirection:"column",gap:5}}>
                                  <Sel value={a?.userId?String(a.userId):""} onChange={e=>{const v=e.target.value||null;updateSlot(slot.role,"userId",v||"");assignSlot(slot.role,v);}} style={{padding:"5px 7px",fontSize:11,borderRadius:6,border:"1px solid #e2e8f0",background:"#fff",width:"100%",maxWidth:"100%"}}>
                                    <option value="">-- Select --</option>
                                    {eligible.map(u=><option key={u.id} value={String(u.id)}>{u.name} ({RESOURCE_ROLES.find(r=>r.key===u.resourceRole)?.label||u.resourceRole||"Team"})</option>)}
                                  </Sel>
                                  <div style={{display:"flex",gap:4}}>
                                    <Inp type="date" value={a?.startDate||""} onChange={e=>updateSlot(slot.role,"startDate",e.target.value)} style={{padding:"3px 5px",fontSize:9,flex:1,borderRadius:5}}/>
                                    <Inp type="date" value={a?.endDate||""} onChange={e=>updateSlot(slot.role,"endDate",e.target.value)} style={{padding:"3px 5px",fontSize:9,flex:1,borderRadius:5}}/>
                                  </div>
                                </div>
                              ):(
                                <div style={{display:"flex",alignItems:"center",gap:8}}>
                                  {m?(
                                    <>
                                      <div style={{position:"relative",flexShrink:0}}>
                                        <div style={{width:34,height:34,borderRadius:"50%",background:bgColor,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:12}}>{initials(m.name)}</div>
                                        <div style={{position:"absolute",bottom:-1,right:-1,width:10,height:10,borderRadius:"50%",background:"#16a34a",border:"2px solid #f8fafc"}}/>
                                      </div>
                                      <div>
                                        <div style={{fontWeight:700,fontSize:13,color:"var(--txt)",lineHeight:1.2}}>{m.name}</div>
                                        <div style={{fontSize:10,color:"#94a3b8"}}>{fmtShort(a.startDate)} - {fmtShort(a.endDate||project.endDate)}</div>
                                      </div>
                                    </>
                                  ):(
                                    <>
                                      <div style={{width:34,height:34,borderRadius:"50%",background:"#e2e8f0",display:"flex",alignItems:"center",justifyContent:"center",color:"#94a3b8",fontSize:14,flexShrink:0}}>-</div>
                                      <span style={{fontSize:12,color:"#94a3b8",fontStyle:"italic"}}>Unassigned</span>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {editTeam&&<div style={{display:"flex",gap:8,marginTop:12,justifyContent:"flex-end"}}><Btn v="secondary" style={{fontSize:11,borderRadius:7}} onClick={()=>setEditTeam(false)}>Cancel</Btn><Btn v="success" style={{fontSize:11,borderRadius:7}} onClick={saveTeam}>Save Team</Btn></div>}
                    </div>

                    {(()=>{
                      const allCLs={...(project.checklists||{}),...(project.customChecklists||{})};
                      const gates=[
                        {label:"TM Approval",key:"tmApproval",icon:"T"},
                        {label:"PM Approval",key:"pmApproval",icon:"P"},
                        {label:"Client Approval",key:"clientApproval",icon:"C"},
                        {label:"Final Sanction",key:"sanction",icon:"S"},
                      ];
                      let totalApproved=0,totalPending=0,totalUpcoming=0;
                      const allItems=Object.values(allCLs).flatMap(cl=>Array.isArray(cl)?cl.flatMap(c=>(c.items||[])):(cl.items||[]));
                      const totalItems=allItems.length||1;
                      gates.forEach(g=>{
                        if(g.key==="sanction"){
                          if(project.sanctioned)totalApproved++;else if(project.pendingSanction)totalPending++;else totalUpcoming++;
                        } else {
                          const approved=allItems.filter(it=>it[g.key]==="Approved").length;
                          const pct=totalItems?approved/totalItems:0;
                          if(pct>=0.8)totalApproved++;else if(pct>0)totalPending++;else totalUpcoming++;
                        }
                      });
                      return(
                        <div style={{background:"var(--card)",border:"1px solid #e2e8f0",borderRadius:12,boxShadow:"0 1px 4px rgba(0,0,0,0.06)",padding:"16px 18px",marginBottom:14}}>
                          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12}}>
                            <span style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.06em"}}>Approval Gates</span>
                            <span style={{fontSize:10,color:"#64748b"}}>{totalApproved} approved · {totalPending} pending · {totalUpcoming} upcoming</span>
                          </div>
                          {gates.map(g=>{
                            let status="upcoming",detail="";
                            if(g.key==="sanction"){
                              if(project.sanctioned){status="approved";detail=fmtShort(project.sanctionedAt);}
                              else if(project.pendingSanction){status="pending";detail="Awaiting approval";}
                              else{detail="Not submitted";}
                            } else {
                              const approved=allItems.filter(it=>it[g.key]==="Approved").length;
                              const pct=totalItems?Math.round((approved/totalItems)*100):0;
                              if(pct>=80){status="approved";detail=`${pct}% approved`;}
                              else if(pct>0){status="pending";detail=`${pct}% approved`;}
                              else{detail="Not started";}
                            }
                            const colors={approved:"#16a34a",pending:"#d97706",upcoming:"#94a3b8"};
                            const icons={approved:"\u2713",pending:"!",upcoming:"\u2022"};
                            return(
                              <div key={g.key} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #f1f5f9"}}>
                                <div style={{width:24,height:24,borderRadius:"50%",background:colors[status]+"18",border:`1.5px solid ${colors[status]}`,display:"flex",alignItems:"center",justifyContent:"center",color:colors[status],fontSize:11,fontWeight:800,flexShrink:0}}>{icons[status]}</div>
                                <div style={{flex:1}}>
                                  <div style={{fontWeight:600,fontSize:12,color:"var(--txt)"}}>{g.label}</div>
                                </div>
                                <span style={{fontSize:10,color:colors[status],fontWeight:600}}>{detail}</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {(()=>{
                      const start=project.startDate?new Date(project.startDate):null;
                      const end=project.endDate?new Date(project.endDate):null;
                      const now=new Date();
                      if(!start||!end)return null;
                      const totalDays=Math.max(1,Math.ceil((end-start)/86400000));
                      const elapsed=Math.ceil((now-start)/86400000);
                      const pct=Math.min(100,Math.max(0,Math.round((elapsed/totalDays)*100)));
                      const remaining=Math.ceil((end-now)/86400000);
                      const overdue=remaining<0;
                      const todayPct=Math.min(100,Math.max(0,Math.round((elapsed/totalDays)*100)));
                      return(
                        <div style={{background:"var(--card)",border:"1px solid #e2e8f0",borderRadius:12,boxShadow:"0 1px 4px rgba(0,0,0,0.06)",padding:"16px 18px",marginBottom:14}}>
                          <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Stage-wise Timeline</div>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                            <span style={{fontSize:11,color:"#64748b",fontWeight:600}}>{fmtShort(project.startDate)}</span>
                            <span style={{fontSize:12,fontWeight:800,color:overdue?"#dc2626":remaining<=14?"#d97706":"#16a34a"}}>{overdue?`OVERDUE by ${Math.abs(remaining)}d`:`${remaining}d remaining`}</span>
                            <span style={{fontSize:11,color:"#64748b",fontWeight:600}}>{fmtShort(project.endDate)}</span>
                          </div>
                          <div style={{position:"relative",height:10,background:"#e2e8f0",borderRadius:99,overflow:"hidden"}}>
                            <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${pct}%`,background:overdue?"linear-gradient(90deg,#dc2626,#f87171)":pct>75?"linear-gradient(90deg,#d97706,#fbbf24)":"linear-gradient(90deg,#6366f1,#818cf8)",borderRadius:99,transition:"width .3s"}}/>
                            <div style={{position:"absolute",top:-3,left:`${todayPct}%`,width:2,height:16,background:"#dc2626",borderRadius:1,transform:"translateX(-1px)"}}/>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
                            <span style={{fontSize:10,color:"#94a3b8"}}>{pct}% elapsed</span>
                            <span style={{fontSize:10,color:"#94a3b8"}}>{totalDays} total days</span>
                          </div>
                        </div>
                      );
                    })()}
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
