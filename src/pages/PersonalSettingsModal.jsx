import { useState } from "react";
import { UNIQ, fmtDate } from "../lib/constants.jsx";
import { Btn, Inp, Lbl, Pill, Modal } from "../components/ui/index.jsx";

const PersonalSettingsModal=({user,onClose,allProjects,onSave,showToast})=>{
  const [tab,setTab]=useState("holidays");
  const [holidays,setHolidays]=useState(user.holidays||[]);
  const [newDate,setNewDate]=useState(""); const [newReason,setNewReason]=useState("");
  const [wallpaper,setWallpaper]=useState(user.wallpaper||"none");
  const WALLS=[{key:"none",label:"Default",bg:"var(--bg)"},{key:"grid",label:"Grid",bg:"repeating-linear-gradient(0deg,var(--bdr) 0,var(--bdr) 1px,transparent 1px,transparent 40px),repeating-linear-gradient(90deg,var(--bdr) 0,var(--bdr) 1px,transparent 1px,transparent 40px)"},{key:"dots",label:"Dots",bg:"radial-gradient(circle,var(--bdr2) 1px,transparent 1px) 0 0/24px 24px"},{key:"blue",label:"Blue Glow",bg:"radial-gradient(ellipse at 50% 0%,var(--acc)20,transparent 70%)"},{key:"green",label:"Green Glow",bg:"radial-gradient(ellipse at 50% 0%,var(--green)18,transparent 70%)"},{key:"purple",label:"Purple Glow",bg:"radial-gradient(ellipse at 50% 0%,var(--purple)18,transparent 70%)"}];
  const addH=()=>{if(!newDate)return;setHolidays(prev=>[...prev,{id:UNIQ(),date:newDate,reason:newReason||"Personal leave",status:"pending"}]);setNewDate("");setNewReason("");};
  return(
    <Modal title="Personal Settings" onClose={onClose} maxW={500}>
      <div style={{display:"flex",gap:2,marginBottom:16,borderBottom:"1px solid var(--bdr)"}}>
        {["holidays","wallpaper"].map(t=><button key={t} onClick={()=>setTab(t)} style={{padding:"8px 14px",background:"none",border:"none",cursor:"pointer",fontSize:14,fontWeight:500,color:tab===t?"#6366f1":"#64748b",borderBottom:`2px solid ${tab===t?"#6366f1":"transparent"}`,marginBottom:-1}}>{t==="holidays"?"Tentative Holidays":"Wallpaper"}</button>)}
      </div>
      {tab==="holidays"&&<div>
        <div style={{fontSize:12,color:"var(--txt2)",marginBottom:12,lineHeight:1.6}}>Mark planned holidays. Super Admin will approve — approved holidays affect availability calculations.</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:8,marginBottom:12,alignItems:"end"}}>
          <div><Lbl>Date</Lbl><Inp type="date" value={newDate} onChange={e=>setNewDate(e.target.value)}/></div>
          <div><Lbl>Reason</Lbl><Inp value={newReason} onChange={e=>setNewReason(e.target.value)} placeholder="e.g. Diwali"/></div>
          <Btn v="success" style={{fontSize:11,padding:"7px 12px"}} onClick={addH}>+ Add</Btn>
        </div>
        {holidays.length===0&&<div style={{textAlign:"center",padding:"14px 0",color:"var(--txt3)",fontSize:12}}>No holidays added.</div>}
        {holidays.map(h=><div key={h.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"var(--s2)",borderRadius:7,marginBottom:6}}><div style={{flex:1}}><div style={{fontWeight:700,fontSize:12,color:"var(--txt)"}}>{fmtDate(h.date)}</div><div style={{fontSize:11,color:"var(--txt2)"}}>{h.reason}</div></div><Pill label={h.status==="approved"?"Approved ✓":h.status==="rejected"?"Rejected":"Pending Approval"} color={h.status==="approved"?"var(--green)":h.status==="rejected"?"var(--red)":"var(--amber)"} small/>{h.status==="pending"&&<button onClick={()=>setHolidays(prev=>prev.filter(x=>x.id!==h.id))} style={{background:"none",border:"none",cursor:"pointer",color:"var(--txt3)",fontSize:14}}>×</button>}</div>)}
        <div style={{display:"flex",gap:8,marginTop:14,justifyContent:"flex-end"}}><Btn v="secondary" onClick={onClose}>Cancel</Btn><Btn v="success" onClick={()=>{onSave(holidays,user.wallpaper);showToast("Holidays submitted for approval","var(--amber)");onClose();}}>Save & Submit</Btn></div>
      </div>}
      {tab==="wallpaper"&&<div>
        <div style={{fontSize:12,color:"var(--txt2)",marginBottom:12}}>Choose a background for your workspace.</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
          {WALLS.map(w=><div key={w.key} onClick={()=>setWallpaper(w.key)} style={{padding:12,borderRadius:8,border:`2px solid ${wallpaper===w.key?"var(--acc)":"var(--bdr)"}`,cursor:"pointer"}}><div style={{height:40,borderRadius:5,background:w.bg,backgroundSize:w.key==="dots"?"24px 24px":"auto",marginBottom:7,border:"1px solid var(--bdr)"}}/><div style={{fontSize:10,fontWeight:600,textAlign:"center"}}>{w.label}</div></div>)}
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Btn v="secondary" onClick={onClose}>Cancel</Btn><Btn onClick={()=>{onSave(user.holidays||[],wallpaper);showToast("Wallpaper applied ✓","var(--green)");onClose();}}>Apply</Btn></div>
      </div>}
    </Modal>
  );
};

export default PersonalSettingsModal;
