// ResourcesView — contains team view, resource planning, efficiency, and hiring plan
// All sub-views are kept inline as in the original monolithic file
import { useState, useRef, useEffect } from "react";
import { RESOURCE_ROLES, HIRING_BASE, CHECKLIST_DEFS, todayStr, fmtDate, fmtShort, UNIQ, initials, getUser, nonAdmins, userCap, activeProjs } from "../../lib/constants.jsx";
import { supabase } from "../../lib/supabase.js";
import { Btn, Inp, Sel, TA, Lbl, Tag, Pill, Bar, Card, Modal, Av, SH, Toast } from "../../components/ui/index.jsx";
import HiringPlanView from "./HiringPlanView.jsx";
import AddResourceModal from "./AddResourceModal.jsx";

const ResourcesView=({projects,users,setUsers,isAdmin,currentUser})=>{
  const [subView,setSubView]=useState("team");
  const [roleFilter,setRoleFilter]=useState("all");
  const [deptFilter,setDeptFilter]=useState("all");
  const [avFrom,setAvFrom]=useState(todayStr());
  const [avTo,setAvTo]=useState(()=>{const d=new Date();d.setMonth(d.getMonth()+2);return d.toISOString().slice(0,10);});
  const [personModal,setPersonModal]=useState(null);
  const [showAddResource,setShowAddResource]=useState(false);
  const [reminderModal,setReminderModal]=useState(null);
  const [editingUser,setEditingUser]=useState(null);
  const [editDraft,setEditDraft]=useState({});
  const [toast,setToast]=useState(null);
  const showToast=(msg,color)=>{setToast({msg,color});setTimeout(()=>setToast(null),2600);};

  const members=users;
  const DEPT_LIST=["Hardware","Firmware","Industrial Design","Testing","Project Management","Supply Chain","DevOps","Solution Architecture","Soldering & Testing","Management"];
  const DEPT_ROLES={
    Hardware:["sr_hw","jr_hw"],Firmware:["sr_fw","jr_fw","jr_fw_2"],"Industrial Design":["ind_design"],
    Testing:["tester"],"Project Management":["sr_pm","jr_pm"],"Supply Chain":["sc"],
    DevOps:["devops"],"Solution Architecture":["sol_arch"],"Soldering & Testing":["soldering"],
    Management:["sr_pm"]
  };

  const filtered=members.filter(m=>{
    const ri=RESOURCE_ROLES.find(r=>r.key===m.resourceRole);
    if(roleFilter!=="all"&&m.resourceRole!==roleFilter)return false;
    if(deptFilter!=="all"){
      const userDept=(m.dept||"").toLowerCase();
      const roleDept=(ri?.label||"").toLowerCase();
      const filterLower=deptFilter.toLowerCase();
      if(!userDept.includes(filterLower)&&!roleDept.includes(filterLower))return false;
    }
    return true;
  });

  const addResource=async(newUser)=>{
    const{data,error}=await supabase.from("users").insert({
      id:            newUser.id,
      name:          newUser.name,
      email:         newUser.email,
      role:          newUser.role||"developer",
      login_type:    newUser.loginType||newUser.role||"developer",
      dept:          newUser.dept||"",
      resource_role: newUser.resourceRole,
      max_projects:  newUser.maxProjects||2,
      project_tags:  newUser.projectTags||["engineering"],
      skills:        newUser.skills||[],
      tags:          newUser.tags||[],
      avatar:        newUser.avatar||newUser.name?.slice(0,2).toUpperCase()||"??",
    }).select("*,holidays!holidays_user_id_fkey(*)").single();
    if(error){alert("Failed to add resource: "+error.message);return;}
    const shaped={...data,resourceRole:data.resource_role,loginType:data.login_type,maxProjects:data.max_projects,projectTags:data.project_tags||[],skills:data.skills||[],holidays:data.holidays||[]};
    setUsers(prev=>[...prev,shaped]);
    showToast(`${newUser.name} added ✓`,"var(--green)");
  };
  const saveUserEdit=async(uid)=>{
    const{data,error}=await supabase.from("users").update({
      name:          editDraft.name,
      dept:          editDraft.dept,
      resource_role: editDraft.resourceRole,
      max_projects:  editDraft.maxProjects,
      project_tags:  editDraft.projectTags,
      skills:        editDraft.skills,
      role:          editDraft.role,
      login_type:    editDraft.loginType||editDraft.role,
    }).eq("id",uid).select("*,holidays!holidays_user_id_fkey(*)").single();
    if(error){alert("Update failed: "+error.message);return;}
    const shaped={...data,resourceRole:data.resource_role,loginType:data.login_type,maxProjects:data.max_projects,projectTags:data.project_tags||[],skills:data.skills||[],holidays:data.holidays||[]};
    setUsers(prev=>prev.map(u=>u.id===uid?shaped:u));
    setEditingUser(null);
    showToast("Resource updated ✓","var(--green)");
  };

  const pendingHolidays=users.flatMap(u=>(u.holidays||[]).filter(h=>h.status==="pending").map(h=>({...h,userName:u.name,userId:u.id})));
  const approveHol=async(userId,hid,status)=>{
    const{error}=await supabase.from("holidays").update({
      status,
      approved_by: currentUser.id,
      approved_at: new Date().toISOString(),
    }).eq("id",hid);
    if(error){alert("Failed: "+error.message);return;}
    setUsers(prev=>prev.map(u=>u.id===userId?{...u,holidays:(u.holidays||[]).map(h=>h.id===hid?{...h,status}:h)}:u));
    showToast(status==="approved"?"Holiday approved ✓":"Rejected","var(--green)");
  };

  const NB=({id,label})=><button onClick={()=>setSubView(id)} style={{padding:"12px 20px",background:"none",border:"none",cursor:"pointer",fontSize:15,fontWeight:600,color:subView===id?"#2563eb":"#64748b",borderBottom:`2.5px solid ${subView===id?"#2563eb":"transparent"}`,transition:"all .15s",marginBottom:-1}}>{label}</button>;

  return(
    <div className="resources-page" style={{flex:1,overflow:"auto",padding:"28px 32px"}}>
      <style>{`
        .resources-page table th { font-size: 12px; padding: 14px 18px; letter-spacing: .05em; }
        .resources-page table td { font-size: 14px; padding: 16px 18px; vertical-align: middle; }
        .resources-page table tbody tr { transition: background .15s; }
        .resources-page table tbody tr:hover td { background: #f8fafc; }
        .resources-page .tbl-wrap { background: #fff; border: 1px solid var(--bdr); border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(15,23,42,.04); }
      `}</style>

      {/* Page header */}
      <div style={{marginBottom:22}}>
        <div style={{fontSize:22,fontWeight:700,color:"#0f172a",letterSpacing:"-0.01em"}}>Resources</div>
        <div style={{fontSize:14,color:"#64748b",marginTop:4}}>Team roster, availability, deployment & hiring plan</div>
      </div>

      {isAdmin&&pendingHolidays.length>0&&(
        <div style={{marginBottom:22,padding:"16px 20px",background:"#fef3c740",border:"1px solid #fcd34d",borderRadius:12}}>
          <SH title={`🌴 Holiday Approval Requests (${pendingHolidays.length})`} color="#d97706"/>
          {pendingHolidays.map(h=>(
            <div key={h.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:"#fff",borderRadius:8,marginBottom:8,border:"1px solid #fde68a"}}>
              <div style={{flex:1}}><div style={{fontWeight:700,fontSize:14,color:"#0f172a"}}>{h.userName}</div><div style={{fontSize:13,color:"#64748b",marginTop:2}}>{fmtDate(h.date)} · {h.reason}</div></div>
              <Btn v="success" style={{fontSize:12,padding:"6px 14px"}} onClick={()=>approveHol(h.userId,h.id,"approved")}>Approve</Btn>
              <Btn v="danger" style={{fontSize:12,padding:"6px 14px"}} onClick={()=>approveHol(h.userId,h.id,"rejected")}>Reject</Btn>
            </div>
          ))}
        </div>
      )}

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:0,borderBottom:"1px solid var(--bdr)"}}>
        <div style={{display:"flex",gap:4,flex:1}}>
          <NB id="team" label="Team View"/>
          <NB id="planning" label="Resource Planning"/>
          <NB id="efficiency" label="Efficiency"/>
          <NB id="hiring" label="Hiring Plan"/>
        </div>
        {isAdmin&&<Btn v="primary" style={{fontSize:13,padding:"9px 18px",marginLeft:12,marginBottom:8,flexShrink:0}} onClick={()=>setShowAddResource(true)}>+ Add Resource</Btn>}
      </div>
      <div style={{height:22}}/>

      {(subView==="team"||subView==="planning")&&(
        <div style={{display:"flex",gap:14,marginBottom:20,flexWrap:"wrap",alignItems:"flex-end"}}>
          <div><Lbl>Role</Lbl><Sel value={roleFilter} onChange={e=>setRoleFilter(e.target.value)} style={{width:210,fontSize:14,padding:"10px 14px"}}><option value="all">All Roles</option>{["senior","junior","shared"].map(tier=><optgroup key={tier} label={tier.charAt(0).toUpperCase()+tier.slice(1)}>{RESOURCE_ROLES.filter(r=>r.tier===tier).map(r=><option key={r.key} value={r.key}>{r.label}</option>)}</optgroup>)}</Sel></div>
          <div><Lbl>Department</Lbl><Sel value={deptFilter} onChange={e=>setDeptFilter(e.target.value)} style={{width:210,fontSize:14,padding:"10px 14px"}}>
            <option value="all">All Departments</option>
            {DEPT_LIST.map(d=><option key={d} value={d}>{d}</option>)}
          </Sel></div>
          {subView==="planning"&&<>
            <div><Lbl>Available From</Lbl><Inp type="date" value={avFrom} onChange={e=>setAvFrom(e.target.value)} style={{width:170,fontSize:14,padding:"10px 14px"}}/></div>
            <div><Lbl>Available To</Lbl><Inp type="date" value={avTo} onChange={e=>setAvTo(e.target.value)} style={{width:170,fontSize:14,padding:"10px 14px"}}/></div>
          </>}
          <div style={{marginLeft:"auto",fontSize:13,color:"#64748b",paddingBottom:10}}>
            <strong style={{color:"#0f172a"}}>{filtered.length}</strong> {filtered.length===1?"resource":"resources"}
          </div>
        </div>
      )}

      {subView==="team"&&(
        <div className="tbl-wrap" style={{overflow:"auto"}}>
          <table>
            <thead><tr>
              <th>Name</th><th>Role</th><th>Dept</th><th>Skills / Tags</th>
              <th>Projects</th><th>Holidays</th>
              <th style={{width:70}}>Cap</th>
              <th>Status</th>
              {isAdmin&&<th style={{width:90}}>Actions</th>}
            </tr></thead>
            <tbody>{filtered.map(m=>{
              const ri=RESOURCE_ROLES.find(r=>r.key===m.resourceRole);
              const allAssigned=projects.filter(p=>p.teamAssignments?.some(a=>a.userId===m.id));
              const active=activeProjs(m.id,projects);const cap=userCap(m);const over=active.length>=cap;
              const mHols=m.holidays||[];
              const mPending=mHols.filter(h=>h.status==="pending");
              const mApproved=mHols.filter(h=>h.status==="approved");
              const isEditing=editingUser===m.id;
              const draftDept=editDraft.dept||m.dept||"";
              const deptRoleKeys=DEPT_ROLES[draftDept]||RESOURCE_ROLES.map(r=>r.key);

              if(isEditing&&isAdmin){
                return(
                  <tr key={m.id} style={{background:"#eff6ff",borderTop:"2px solid #2563eb40"}}>
                    <td><input value={editDraft.name||""} onChange={e=>setEditDraft(d=>({...d,name:e.target.value}))} style={{background:"#fff",border:"1px solid #cbd5e1",borderRadius:6,padding:"8px 12px",fontSize:14,color:"#0f172a",width:"100%",outline:"none",fontWeight:500}}/></td>
                    <td><Sel value={editDraft.resourceRole||m.resourceRole} onChange={e=>setEditDraft(d=>({...d,resourceRole:e.target.value}))} style={{fontSize:13,padding:"7px 10px"}}>{RESOURCE_ROLES.filter(r=>deptRoleKeys.includes(r.key)).map(r=><option key={r.key} value={r.key}>{r.label}</option>)}</Sel></td>
                    <td><Sel value={editDraft.dept||m.dept||""} onChange={e=>setEditDraft(d=>({...d,dept:e.target.value,resourceRole:DEPT_ROLES[e.target.value]?.[0]||d.resourceRole}))} style={{fontSize:13,padding:"7px 10px"}}><option value="">— Dept —</option>{DEPT_LIST.map(d=><option key={d} value={d}>{d}</option>)}</Sel></td>
                    <td>
                      <div style={{display:"flex",flexDirection:"column",gap:5}}>
                        {[{key:"engineering",label:"Engineering",color:"var(--blue)"},{key:"elecbits_product",label:"EB Product",color:"var(--green)"},{key:"modifier",label:"Modifier",color:"var(--purple)"}].map(pt=>{
                          const tags=editDraft.projectTags||m.projectTags||["engineering"];
                          const active2=tags.includes(pt.key);
                          return(<button key={pt.key} onClick={()=>{const cur=editDraft.projectTags||m.projectTags||["engineering"];const next=active2?cur.filter(x=>x!==pt.key):[...cur,pt.key];setEditDraft(d=>({...d,projectTags:next.length?next:cur}));}} style={{padding:"4px 10px",borderRadius:6,border:"1px solid "+(active2?pt.color:"#cbd5e1"),background:active2?pt.color+"18":"transparent",color:active2?pt.color:"#64748b",fontSize:11,cursor:"pointer",fontWeight:700,textAlign:"left"}}>{active2?"✓ ":""}{pt.label}</button>);
                        })}
                      </div>
                    </td>
                    <td style={{fontSize:12,color:"#64748b"}}>{allAssigned.length} project{allAssigned.length!==1?"s":""}{active.length<allAssigned.length&&` (${active.length} active)`}</td>
                    <td style={{fontSize:12}}>{mPending.length>0&&<div style={{color:"#d97706",fontWeight:600}}>⏳ {mPending.length}</div>}{mApproved.length>0&&<div style={{color:"#16a34a",fontWeight:600}}>✓ {mApproved.length}</div>}</td>
                    <td><input type="number" min="1" max="10" value={editDraft.maxProjects??cap} onChange={e=>setEditDraft(d=>({...d,maxProjects:Number(e.target.value)}))} style={{width:56,background:"#fff",border:"1.5px solid #2563eb",borderRadius:6,color:"#2563eb",padding:"7px 8px",fontSize:15,textAlign:"center",outline:"none",fontFamily:"IBM Plex Mono",fontWeight:700}}/></td>
                    <td><Pill label={over?"At Cap":active.length?"Deployed":"Available"} color={over?"var(--red)":active.length?"var(--amber)":"var(--green)"}/></td>
                    <td>
                      <div style={{display:"flex",gap:5,flexDirection:"column"}}>
                        <div style={{display:"flex",gap:5}}>
                          <Btn v="success" style={{fontSize:12,padding:"6px 12px"}} onClick={()=>saveUserEdit(m.id)}>✓ Save</Btn>
                          <Btn v="secondary" style={{fontSize:12,padding:"6px 12px"}} onClick={()=>setEditingUser(null)}>✗</Btn>
                        </div>
                        <Btn v="danger" style={{fontSize:11,padding:"5px 10px",width:"100%",justifyContent:"center"}} onClick={()=>{
                          if(window.confirm(`Remove ${m.name} from the team?\nThey will be unassigned from all projects.`)){
                            (async()=>{const{error}=await supabase.from("users").delete().eq("id",m.id);if(error){alert("Delete failed: "+error.message);return;}setUsers(prev=>prev.filter(u=>u.id!==m.id));})();
                            setEditingUser(null);showToast(`${m.name} removed`,"var(--red)");
                          }
                        }}>🗑 Remove</Btn>
                      </div>
                    </td>
                  </tr>
                );
              }
              return(<tr key={m.id}>
                <td><button onClick={()=>setPersonModal(m)} style={{background:"none",border:"none",cursor:"pointer",color:"#0f172a",display:"flex",alignItems:"center",gap:12,padding:0,fontSize:15,fontWeight:600}}><Av uid={m.id} size={36} users={users}/>{m.name}</button></td>
                <td>{ri&&<Tag label={ri.label} color={ri.color}/>}</td>
                <td style={{fontSize:13,color:"#475569",fontWeight:500}}>{m.dept||ri?.label||"—"}</td>
                <td><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {(m.projectTags||[]).map(t=>{const colors={engineering:"var(--blue)",elecbits_product:"var(--green)",modifier:"var(--purple)"};const labels={engineering:"Engineering",elecbits_product:"EB Product",modifier:"Modifier"};return <span key={t} style={{padding:"3px 9px",borderRadius:5,fontSize:11,fontWeight:700,background:(colors[t]||"var(--acc)")+"18",color:colors[t]||"var(--acc)",border:"1px solid "+(colors[t]||"var(--acc)")+"40"}}>{labels[t]||t}</span>;})}
                  {!(m.projectTags||[]).length&&<span style={{fontSize:13,color:"#94a3b8"}}>—</span>}
                </div></td>
                <td>{allAssigned.length>0?allAssigned.map(p=>{const a=p.teamAssignments?.find(x=>x.userId===m.id);const isActive=active.some(ap=>ap.id===p.id);return(<div key={p.id} style={{marginBottom:5,opacity:isActive?1:0.55}}><div style={{fontSize:13,fontWeight:600,color:"#0f172a"}}>{p.name}{!isActive&&<span style={{fontSize:11,color:"#94a3b8",marginLeft:6,fontWeight:500}}>(ended)</span>}</div><div style={{fontSize:11,color:"#64748b",marginTop:1,fontFamily:"IBM Plex Mono"}}>{fmtShort(a?.startDate)}–{fmtShort(a?.endDate||p.endDate)}</div></div>)}):<span style={{fontSize:13,color:"#94a3b8"}}>None</span>}</td>
                <td style={{fontSize:12}}>{mPending.length>0&&<div style={{color:"#d97706",marginBottom:3,fontWeight:600}}>⏳ {mPending.length} pending</div>}{mApproved.length>0&&<div style={{color:"#16a34a",fontWeight:600}}>✓ {mApproved.length} approved</div>}{mPending.length===0&&mApproved.length===0&&<span style={{color:"#94a3b8"}}>—</span>}</td>
                <td style={{textAlign:"center",fontFamily:"IBM Plex Mono",color:over?"var(--red)":"var(--green)",fontWeight:700,fontSize:15}}>{active.length}/{cap}</td>
                <td><Pill label={over?"At Capacity":active.length?"Deployed":"Available"} color={over?"var(--red)":active.length?"var(--amber)":"var(--green)"}/></td>
                {isAdmin&&<td><div style={{display:"flex",gap:6}}><Btn v="ghost" style={{fontSize:13,padding:"6px 10px"}} onClick={()=>{setEditingUser(m.id);setEditDraft({name:m.name,resourceRole:m.resourceRole,dept:m.dept||"",maxProjects:m.maxProjects||cap,projectTags:m.projectTags||["engineering"]});}}>✏</Btn><Btn v="ghost" style={{fontSize:13,padding:"6px 10px"}} onClick={()=>setReminderModal(m)}>📨</Btn></div></td>}
              </tr>);
            })}</tbody>
          </table>
        </div>
      )}

      {subView==="planning"&&(
        <div>
          <div style={{fontSize:13,color:"#475569",marginBottom:14,padding:"12px 16px",background:"#f1f5f9",borderRadius:10,border:"1px solid #e2e8f0"}}>
            Showing resources with <strong style={{color:"#0f172a"}}>any availability</strong> in the period <strong style={{color:"#2563eb"}}>{fmtDate(avFrom)}</strong> → <strong style={{color:"#2563eb"}}>{fmtDate(avTo)}</strong>.
          </div>
          <div className="tbl-wrap" style={{overflow:"auto"}}>
            <table>
              <thead><tr><th>Resource</th><th>Role</th><th>Available Window in Period</th><th>Deployed Projects</th><th>Holidays in Period</th><th>Status</th></tr></thead>
              <tbody>
                {filtered.map(m=>{
                  const ri=RESOURCE_ROLES.find(r=>r.key===m.resourceRole);
                  const deployedInRange=projects.filter(p=>p.teamAssignments?.some(a=>a.userId===m.id&&a.startDate<=avTo&&(a.endDate||"9999")>=avFrom));
                  const approvedHols2=(m.holidays||[]).filter(h=>h.status==="approved"&&h.date>=avFrom&&h.date<=avTo);
                  const pendingHolsInRange=(m.holidays||[]).filter(h=>h.status==="pending"&&h.date>=avFrom&&h.date<=avTo);
                  const isBusy=deployedInRange.length>=(userCap(m));
                  let freeWindow="Fully free: "+fmtShort(avFrom)+" → "+fmtShort(avTo);
                  if(deployedInRange.length>0&&!isBusy)freeWindow="Partially available — check deployments";
                  if(isBusy)freeWindow="At capacity in this period";
                  return(
                    <tr key={m.id}>
                      <td><button onClick={()=>setPersonModal(m)} style={{background:"none",border:"none",cursor:"pointer",color:"#0f172a",display:"flex",alignItems:"center",gap:11,padding:0,fontSize:14,fontWeight:600}}><Av uid={m.id} size={32} users={users}/>{m.name}</button></td>
                      <td>{ri&&<Tag label={ri.label} color={ri.color}/>}</td>
                      <td><span style={{fontSize:13,color:isBusy?"var(--red)":deployedInRange.length?"var(--amber)":"var(--green)",fontWeight:600}}>{freeWindow}</span></td>
                      <td>{deployedInRange.length>0?deployedInRange.map(p=>{const a=p.teamAssignments?.find(x=>x.userId===m.id);return(<div key={p.id} style={{marginBottom:4}}><div style={{fontSize:13,fontWeight:600,color:"#0f172a"}}>{p.name}</div><div style={{fontSize:11,color:"#64748b",marginTop:1,fontFamily:"IBM Plex Mono"}}>{fmtShort(a?.startDate)}–{fmtShort(a?.endDate||p.endDate)}</div></div>)}):<span style={{fontSize:13,color:"#94a3b8"}}>None in range</span>}</td>
                      <td>{approvedHols2.length>0||pendingHolsInRange.length>0?(<div>{approvedHols2.map(h=><div key={h.id} style={{fontSize:12,color:"#d97706",marginBottom:3,fontWeight:600}}>✓ {fmtShort(h.date)}: {h.reason}</div>)}{pendingHolsInRange.map(h=><div key={h.id} style={{fontSize:12,color:"#64748b",marginBottom:3}}>⏳ {fmtShort(h.date)}: {h.reason} <em>(pending)</em></div>)}</div>):<span style={{fontSize:13,color:"#94a3b8"}}>None</span>}</td>
                      <td><Pill label={isBusy?"At Capacity":deployedInRange.length?"Partially Deployed":"Available"} color={isBusy?"var(--red)":deployedInRange.length?"var(--amber)":"var(--green)"}/></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subView==="efficiency"&&(
        <div className="tbl-wrap" style={{overflow:"auto"}}>
          <table><thead><tr><th>Name</th><th>Role</th><th>Projects</th><th>Tasks</th><th>Fully Approved</th><th>Blocked</th><th>Completion</th></tr></thead>
          <tbody>{members.map(m=>{const ri=RESOURCE_ROLES.find(r=>r.key===m.resourceRole);let tot=0,dn=0,bl=0;projects.filter(p=>p.teamAssignments?.some(a=>a.userId===m.id)).forEach(p=>{Object.values(p.checklists||{}).forEach(cl=>{(Array.isArray(cl)?cl:[cl]).forEach(c=>{(c.items||[]).forEach(it=>{tot++;if(it.tmApproval==="Approved"&&it.pmApproval==="Approved"&&it.clientApproval==="Approved")dn++;if(it.status==="Blocked")bl++;});});});});const pct=tot?Math.round((dn/tot)*100):0;return(<tr key={m.id}><td><div style={{display:"flex",alignItems:"center",gap:12}}><Av uid={m.id} size={34} users={users}/><span style={{fontWeight:600,fontSize:15,color:"#0f172a"}}>{m.name}</span></div></td><td>{ri&&<Tag label={ri.label} color={ri.color}/>}</td><td style={{textAlign:"center",fontFamily:"IBM Plex Mono",fontSize:15,fontWeight:600,color:"#0f172a"}}>{projects.filter(p=>p.teamAssignments?.some(a=>a.userId===m.id)).length}</td><td style={{textAlign:"center",fontFamily:"IBM Plex Mono",fontSize:15,fontWeight:600,color:"#0f172a"}}>{tot}</td><td style={{textAlign:"center",fontFamily:"IBM Plex Mono",fontSize:15,fontWeight:700,color:"#16a34a"}}>{dn}</td><td style={{textAlign:"center",fontFamily:"IBM Plex Mono",fontSize:15,fontWeight:700,color:bl?"#dc2626":"#94a3b8"}}>{bl}</td><td style={{width:160}}><Bar val={pct}/></td></tr>);})}</tbody></table>
        </div>
      )}

      {subView==="hiring"&&<HiringPlanView members={members}/>}

      {personModal&&<Modal title={personModal.name} onClose={()=>setPersonModal(null)} maxW={520}>
        <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:20,padding:"18px 20px",background:"#f1f5f9",borderRadius:12,border:"1px solid #e2e8f0"}}><Av uid={personModal.id} size={58} users={users}/><div><div style={{fontWeight:800,fontSize:18,marginBottom:6,color:"#0f172a"}}>{personModal.name}</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{RESOURCE_ROLES.find(r=>r.key===personModal.resourceRole)&&<Tag label={RESOURCE_ROLES.find(r=>r.key===personModal.resourceRole).label} color={RESOURCE_ROLES.find(r=>r.key===personModal.resourceRole).color}/>}<Tag label={personModal.email} color="#64748b"/>{(personModal.tags||[]).map(t=><span key={t} style={{padding:"3px 8px",borderRadius:5,fontSize:11,fontWeight:700,background:"#2563eb15",color:"#2563eb"}}>{t}</span>)}</div></div></div>
        <SH title="Deployed Projects"/>
        {projects.filter(p=>p.teamAssignments?.some(a=>a.userId===personModal.id)).map(p=>{const a=p.teamAssignments?.find(x=>x.userId===personModal.id);const isNow=a&&a.startDate<=todayStr()&&(a.endDate||"9999")>=todayStr();return(<div key={p.id} style={{padding:"14px 16px",background:"#fff",borderRadius:10,marginBottom:8,border:`1px solid ${isNow?"#2563eb33":"#e2e8f0"}`}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div><div style={{fontWeight:700,fontSize:14,color:"#0f172a"}}>{p.name}</div><div style={{fontSize:12,color:"#64748b",marginTop:2}}>{a?.role}</div></div>{isNow&&<Pill label="Active" color="#2563eb"/>}</div><div style={{fontSize:13,marginTop:8,color:"#475569"}}><span style={{color:"#94a3b8"}}>Period: </span>{fmtDate(a?.startDate)} → {fmtDate(a?.endDate||p.endDate)}</div></div>);})}
      </Modal>}
      {showAddResource&&<AddResourceModal onClose={()=>setShowAddResource(false)} addResource={addResource} users={users} DEPT_ROLES={DEPT_ROLES}/>}
      {reminderModal&&<Modal title={`Remind ${reminderModal.name}`} onClose={()=>setReminderModal(null)} maxW={440}><div style={{display:"flex",flexDirection:"column",gap:12}}><TA rows={3} placeholder="Message…"/><div style={{display:"flex",gap:6,justifyContent:"flex-end"}}><Btn v="secondary" onClick={()=>setReminderModal(null)}>Cancel</Btn><Btn v="success" onClick={()=>{showToast(`Sent to ${reminderModal.name} 📨`,"var(--blue)");setReminderModal(null);}}>Send</Btn></div></div></Modal>}
      {toast&&<Toast {...toast}/>}
    </div>
  );
};

export default ResourcesView;
