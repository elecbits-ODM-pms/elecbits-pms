import { useState } from "react";
import { RESOURCE_ROLES, TEAM_SLOTS, PROJECT_TAGS, tagLabel, tagColor, CHECKLIST_DEFS, todayStr, fmtDate, getUser } from "../lib/constants.jsx";
import { Btn, Inp, Sel, TA, Lbl, Tag, Divider, Pill } from "./ui/index.jsx";

const ProjectForm=({initial,onSave,onClose,allProjects,users,isAdmin})=>{
  const blank={name:"",projectId:"",productIds:[""],projectTag:"engineering",description:"",clientName:"",clientId:"",startDate:"",endDate:"",submitForSanction:false};
  const [f,setF]=useState(initial?{...initial,productIds:initial.productIds||[initial.productId||""]}:blank);
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const [slots,setSlots]=useState(()=>{const init={};TEAM_SLOTS.forEach(s=>{const a=initial?.teamAssignments?.find(x=>x.role===s.role);init[s.role]={userId:a?.userId||"",startDate:a?.startDate||initial?.startDate||"",endDate:a?.endDate||initial?.endDate||""};});return init;});
  const setSlot=(role,k,v)=>setSlots(prev=>({...prev,[role]:{...prev[role],[k]:v}}));
  const dateErr=f.endDate&&f.startDate&&f.endDate<f.startDate?"End date cannot be before start date":"";
  const addProductId=()=>setF(x=>({...x,productIds:[...x.productIds,""]}));
  const setProductId=(i,v)=>setF(x=>({...x,productIds:x.productIds.map((p,idx)=>idx===i?v:p)}));
  const removeProductId=(i)=>setF(x=>({...x,productIds:x.productIds.filter((_,idx)=>idx!==i)}));
  const getConflicts=(role,userId)=>{
    if(!userId)return null;
    const uid=userId;const sl=slots[role];
    const conflicts=allProjects.filter(p=>
      p.id!==initial?.id&&!p.rejected&&
      p.teamAssignments?.some(a=>
        a.userId===uid&&sl.startDate&&sl.endDate&&
        !(a.endDate<sl.startDate||sl.endDate<a.startDate)
      )
    ).map(p=>p.name);
    if(!conflicts.length)return null;
    if(conflicts.length===1)return conflicts[0];
    return conflicts.slice(0,-1).join(", ")+" & "+conflicts[conflicts.length-1]+" ("+conflicts.length+" conflicts)";
  };
  const [clConfig,setClConfig]=useState(()=>{
    const init={};
    (initial?.productIds||[""]).filter(Boolean).forEach((pid,i)=>{
      const pidKey=pid||("pcb-"+i);
      init[pidKey]=(initial?.checklistConfig?.[pidKey])||1;
    });
    return init;
  });

  const save=()=>{
    if(!f.name)return alert("Project name required");
    if(!f.projectId)return alert("Project ID required");
    if(dateErr)return alert(dateErr);
    const isDuplicate=allProjects.some(p=>p.id!==initial?.id&&p.projectId===f.projectId);
    if(isDuplicate)return alert("Project ID \""+f.projectId+"\" already exists. Use a unique ID.");
    const teamAssignments=TEAM_SLOTS.filter(s=>slots[s.role].userId).map(s=>({
      userId:slots[s.role].userId,role:s.role,
      startDate:slots[s.role].startDate||f.startDate,
      endDate:slots[s.role].endDate||f.endDate
    }));
    onSave({
      ...f,productId:f.productIds[0]||"",
      teamAssignments,
      checklistConfig:clConfig,
      sanctioned:f.submitForSanction?false:(initial?.sanctioned||false)
    });
  };
  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 14px"}}>
        <div style={{gridColumn:"span 2"}}><Lbl>Project Name</Lbl><Inp value={f.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Smart Plug v3"/></div>
        <div><Lbl>Project ID</Lbl><Inp value={f.projectId} onChange={e=>set("projectId",e.target.value)} placeholder="EB-2408"/></div>
        <div><Lbl>Project Tag</Lbl><Sel value={f.projectTag} onChange={e=>set("projectTag",e.target.value)}>{PROJECT_TAGS.map(t=><option key={t.key} value={t.key}>{t.label}</option>)}</Sel></div>
        <div><Lbl>Client Name</Lbl><Inp value={f.clientName||""} onChange={e=>set("clientName",e.target.value)} placeholder="e.g. Acme Corp"/></div>
        <div><Lbl>Client ID</Lbl><Inp value={f.clientId||""} onChange={e=>set("clientId",e.target.value)} placeholder="CLT-001"/></div>
        <div><Lbl>Start Date</Lbl><Inp type="date" value={f.startDate} onChange={e=>set("startDate",e.target.value)}/></div>
        <div><Lbl>End Date</Lbl><Inp type="date" value={f.endDate} onChange={e=>set("endDate",e.target.value)} style={{borderColor:dateErr?"var(--red)":"var(--bdr)"}}/>{dateErr&&<div style={{fontSize:10,color:"var(--red)",marginTop:3}}>⚠ {dateErr}</div>}</div>
        <div style={{gridColumn:"span 2"}}><Lbl>Description</Lbl><TA value={f.description} onChange={e=>set("description",e.target.value)} rows={2}/></div>
      </div>
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><Lbl style={{marginBottom:0}}>Electronics PCB IDs</Lbl><Btn v="ghost" style={{fontSize:10,padding:"2px 8px"}} onClick={addProductId}>+ Add</Btn></div>
        {f.productIds.map((pid,i)=><div key={i} style={{display:"flex",gap:6,marginBottom:5,alignItems:"center"}}><Inp value={pid} onChange={e=>setProductId(i,e.target.value)} placeholder={`PD-${150+i}`} style={{flex:1}}/>{f.productIds.length>1&&<button onClick={()=>removeProductId(i)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--red)",fontSize:15,padding:"0 4px",flexShrink:0}}>×</button>}</div>)}
      </div>
      {isAdmin&&(
        <div style={{padding:"14px 16px",background:"var(--s2)",borderRadius:8,border:"1px solid var(--bdr)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <Lbl style={{marginBottom:0}}>Checklist Sets</Lbl>
            <span style={{fontSize:10,color:"var(--txt3)",fontFamily:"IBM Plex Mono"}}>{f.productIds.filter(Boolean).length} Electronics PCB ID{f.productIds.filter(Boolean).length!==1?"s":""}</span>
          </div>
          <div style={{fontSize:11,color:"var(--txt2)",marginBottom:12,lineHeight:1.6}}>
            For each Electronics PCB ID, you can add one or more sets of checklists. Each set covers the full engineering workflow.
          </div>
          {f.productIds.filter(Boolean).length===0&&(
            <div style={{fontSize:11,color:"var(--txt3)",textAlign:"center",padding:"10px 0"}}>Add at least one Electronics PCB ID above to configure checklists.</div>
          )}
          {f.productIds.filter(Boolean).map((pid,pi)=>{
            const pidKey=pid||("pcb-"+pi);
            const sets=clConfig[pidKey]||1;
            return(
              <div key={pidKey} style={{padding:"12px 14px",background:"var(--bg)",borderRadius:8,marginBottom:8,border:"1px solid var(--bdr2)"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                  <div>
                    <span style={{fontWeight:700,fontSize:12,color:"var(--acc)",fontFamily:"IBM Plex Mono"}}>{pid}</span>
                    <span style={{fontSize:10,color:"var(--txt3)",marginLeft:8}}>Electronics PCB ID</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:11,color:"var(--txt2)"}}>Checklist sets:</span>
                    <div style={{display:"flex",gap:5,alignItems:"center"}}>
                      <button onClick={()=>setClConfig(prev=>({...prev,[pidKey]:Math.max(1,(prev[pidKey]||1)-1)}))}
                        style={{width:28,height:28,borderRadius:6,border:"1px solid var(--bdr)",background:"var(--s2)",color:"var(--txt2)",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>−</button>
                      <span style={{minWidth:28,textAlign:"center",fontFamily:"IBM Plex Mono",fontWeight:800,fontSize:15,color:"var(--acc)"}}>{sets}</span>
                      <button onClick={()=>setClConfig(prev=>({...prev,[pidKey]:(prev[pidKey]||1)+1}))}
                        style={{width:28,height:28,borderRadius:6,border:"1px solid var(--bdr)",background:"var(--s2)",color:"var(--txt2)",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>+</button>
                    </div>
                  </div>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                  {Array.from({length:sets},(_,si)=>(
                    <div key={si} style={{padding:"5px 0",width:"100%"}}>
                      {si>0&&<div style={{fontSize:9,color:"var(--txt3)",fontFamily:"IBM Plex Mono",fontWeight:700,marginBottom:5,marginTop:4}}>SET {si+1}</div>}
                      <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                        {[
                          {key:"pm_milestone",icon:"🎯",label:"PM / Milestone"},
                          {key:"hw_design",icon:"⬡",label:"HW / Hardware"},
                          {key:"hw_testing",icon:"🔬",label:"Hardware Testing"},
                          {key:"fw_logic",icon:"◈",label:"Firmware — Logic"},
                          {key:"fw_testing",icon:"🧪",label:"Firmware Testing"},
                          {key:"id_design",icon:"◉",label:"Industrial Design"},
                          {key:"id_testing",icon:"📐",label:"ID Testing"},
                          {key:"overall_testing",icon:"✅",label:"Overall Testing"},
                          {key:"production",icon:"🏭",label:"Production"},
                        ].map(cl=>(
                          <span key={cl.key} style={{padding:"3px 8px",borderRadius:4,background:"var(--s2)",border:"1px solid var(--bdr)",fontSize:10,color:"var(--txt2)",display:"flex",alignItems:"center",gap:4}}>
                            <span>{cl.icon}</span><span>{cl.label}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Divider/>
      <div>
        <Lbl>Team Assignment</Lbl>
        <div style={{padding:"7px 10px",background:"var(--s2)",borderRadius:6,fontSize:11,color:"var(--txt2)",marginBottom:10}}>
          Only resources tagged for <Tag label={tagLabel(f.projectTag)} color={tagColor(f.projectTag)}/> projects are shown. Role slots are fixed.
          {isAdmin&&<span style={{color:"var(--blue)"}}> · Super Admin can set <strong>Senior PM (TM)</strong> — it applies to the entire project.</span>}
          {!isAdmin&&<span style={{color:"var(--amber)"}}> TM/PM roles managed by Super Admin.</span>}
        </div>
        {TEAM_SLOTS.map(slot=>{
          const eligible=users.filter(u=>slot.roleKeys.includes(u.resourceRole)&&(!f.projectTag||(u.projectTags||[]).includes(f.projectTag)));
          const isTMorPM=["Senior PM","PM"].includes(slot.role);
          const disabled=!isAdmin&&isTMorPM;
          const conflict=getConflicts(slot.role,slots[slot.role].userId);
          const selUid=slots[slot.role].userId||null;
          const selUser=selUid?users.find(u=>u.id===selUid):null;
          const userHols=selUser?(selUser.holidays||[]):[];
          const pendingHols=userHols.filter(h=>h.status==="pending");
          const approvedHols=userHols.filter(h=>h.status==="approved");
          const allSelHols=[...approvedHols,...pendingHols];
          const slotStart=slots[slot.role].startDate||f.startDate;
          const slotEnd=slots[slot.role].endDate||f.endDate;
          const holsInRange=allSelHols.filter(h=>(!slotStart||h.date>=slotStart)&&(!slotEnd||h.date<=slotEnd));

          const getAvailability=(u)=>{
            const pStart=f.startDate||slotStart;
            const pEnd=f.endDate||slotEnd;
            if(!pStart||!pEnd)return{status:"unknown",label:""};
            const busyProjects=allProjects.filter(p=>
              p.id!==initial?.id&&
              p.teamAssignments?.some(a=>
                a.userId===u.id&&
                a.startDate<=pEnd&&
                (a.endDate||"9999")>=pStart
              )
            );
            const cap=u.maxProjects||RESOURCE_ROLES.find(r=>r.key===u.resourceRole)?.maxProjects||2;
            const busyCount=busyProjects.length;
            if(busyCount>=cap)return{status:"full",label:" 🔴 At capacity"};
            if(busyCount>0)return{status:"partial",label:" 🟡 "+busyCount+" project"+(busyCount>1?"s":"")+" in period"};
            return{status:"free",label:" 🟢 Available"};
          };
          return(
            <div key={slot.role} style={{marginBottom:8,opacity:disabled?0.5:1}}>
              <div style={{display:"grid",gridTemplateColumns:"140px 1fr 90px 90px",gap:6,alignItems:"start"}}>
                <div style={{fontSize:11,color:isTMorPM?"var(--coral)":"var(--txt2)",fontWeight:700,fontFamily:"IBM Plex Mono",paddingTop:8}}>{slot.role}{isTMorPM&&<span style={{fontSize:8,color:"var(--txt3)",display:"block",fontWeight:400}}>Admin only</span>}</div>
                <div>
                  <Sel value={slots[slot.role].userId} onChange={e=>setSlot(slot.role,"userId",e.target.value)} disabled={disabled} style={{padding:"5px 8px",fontSize:11,borderColor:conflict?"var(--red)":holsInRange.length>0?"var(--amber)":"var(--bdr)"}}>
                    <option value="">— Select {slot.role} —</option>
                    {eligible.map(u=>{
                      const ri=RESOURCE_ROLES.find(r=>r.key===u.resourceRole);
                      const uAllHols=(u.holidays||[]).filter(h=>h.status==="pending"||h.status==="approved");
                      const holLabel=uAllHols.length>0?" 🌴 "+uAllHols.length+" hol.":"";
                      const av=getAvailability(u);
                      return <option key={u.id} value={u.id}>{u.name} ({ri?.label||u.dept}){av.label}{holLabel}</option>;
                    })}
                    {eligible.length===0&&<option disabled>No eligible resource for this project type</option>}
                  </Sel>
                  {conflict&&<div style={{fontSize:9,color:"var(--red)",marginTop:2,fontFamily:"IBM Plex Mono"}}>⚠ Scheduling conflict: {conflict}</div>}
                  {selUser&&(()=>{
                    const av=getAvailability(selUser);
                    const colors={free:"var(--green)",partial:"var(--amber)",full:"var(--red)",unknown:"var(--txt3)"};
                    if(av.status==="unknown")return null;
                    return(<div style={{marginTop:3,fontSize:10,color:colors[av.status],fontWeight:600}}>{av.label.trim()}</div>);
                  })()}
                </div>
                <Inp type="date" value={slots[slot.role].startDate} onChange={e=>setSlot(slot.role,"startDate",e.target.value)} disabled={disabled} style={{padding:"5px 6px",fontSize:10}}/>
                <Inp type="date" value={slots[slot.role].endDate} onChange={e=>setSlot(slot.role,"endDate",e.target.value)} disabled={disabled} style={{padding:"5px 6px",fontSize:10}}/>
              </div>
              {selUser&&allSelHols.length>0&&(
                <div style={{marginTop:4,marginLeft:146,padding:"6px 10px",background:"var(--amber)08",border:"1px solid var(--amber)30",borderRadius:5,fontSize:10,color:"var(--amber)"}}>
                  🌴 <strong>{selUser.name}</strong> — Not available on:&nbsp;
                  {allSelHols.map((h,i)=>(
                    <span key={h.id} style={{fontFamily:"IBM Plex Mono",background:holsInRange.some(x=>x.id===h.id)?"var(--amber)25":"transparent",padding:"0 3px",borderRadius:3,fontWeight:holsInRange.some(x=>x.id===h.id)?700:400}}>
                      {fmtDate(h.date)} ({h.reason}{h.status==="pending"?" — pending":""})
                      {i<allSelHols.length-1?", ":""}
                    </span>
                  ))}
                  {holsInRange.length>0&&<span style={{display:"block",marginTop:2,fontWeight:700}}>⚠ {holsInRange.length} of these fall within the project period</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <Divider/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:"var(--s2)",borderRadius:8,border:`1px solid ${f.submitForSanction?"var(--amber)40":"var(--bdr)"}`}}>
        <div><div style={{fontWeight:700,fontSize:12,color:"var(--txt)",marginBottom:2}}>Submit for Sanction</div><div style={{fontSize:11,color:"var(--txt2)"}}>Send this project for Super Admin approval.</div></div>
        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}><div style={{position:"relative",width:36,height:20}}><input type="checkbox" checked={f.submitForSanction} onChange={e=>set("submitForSanction",e.target.checked)} style={{opacity:0,width:"100%",height:"100%",position:"absolute",cursor:"pointer",zIndex:1,margin:0}}/><div style={{position:"absolute",inset:0,background:f.submitForSanction?"var(--amber)":"var(--bdr)",borderRadius:99,transition:"background .2s"}}/><div style={{position:"absolute",top:2,left:f.submitForSanction?18:2,width:16,height:16,background:"#fff",borderRadius:"50%",transition:"left .2s",boxShadow:"0 1px 4px #0004"}}/></div><span style={{fontSize:11,color:f.submitForSanction?"var(--amber)":"var(--txt2)",fontWeight:700,fontFamily:"IBM Plex Mono"}}>{f.submitForSanction?"Submit":"Draft"}</span></label>
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Btn v="secondary" onClick={onClose}>Cancel</Btn><Btn onClick={save}>💾 {f.submitForSanction?"Submit for Sanction":"Save as Draft"}</Btn></div>
    </div>
  );
};

export default ProjectForm;
