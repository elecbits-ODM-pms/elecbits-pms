import { avColors, getUser, MONO } from "../../lib/constants.jsx";

export const Av=({uid,size=30,users})=>{
  const u=getUser(uid,users||[]);
  const c=avColors[((uid||1)-1)%avColors.length];
  return <div style={{width:size,height:size,borderRadius:"50%",background:`${c}18`,border:`1.5px solid ${c}50`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.32,fontWeight:600,color:c,flexShrink:0}}>{u?.avatar||"?"}</div>;
};
export const Pill=({label,color,small,dot=true})=>(
  <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:small?"3px 8px":"4px 12px",borderRadius:99,fontSize:small?10:11,fontWeight:600,background:`${color||"var(--txt3)"}14`,color:color||"var(--txt2)",border:`1px solid ${color||"var(--txt3)"}30`,whiteSpace:"nowrap"}}>
    {dot&&<span style={{width:5,height:5,borderRadius:"50%",background:color||"var(--txt3)",flexShrink:0}}/>}{label}
  </span>
);
export const Tag=({label,color})=>(
  <span style={{padding:"2px 8px",borderRadius:6,fontSize:11,fontWeight:600,background:`${color||"var(--txt3)"}14`,color:color||"var(--txt3)",border:`1px solid ${color||"var(--txt3)"}30`,whiteSpace:"nowrap"}}>{label}</span>
);
export const Bar=({val,color,thin})=>(
  <div style={{display:"flex",alignItems:"center",gap:6}}>
    <div style={{flex:1,height:thin?4:6,background:"var(--bdr)",borderRadius:99,overflow:"hidden"}}><div style={{width:`${Math.max(0,Math.min(100,val||0))}%`,height:"100%",background:color||(val>=70?"#16a34a":val>=40?"#2563eb":"#d97706"),borderRadius:99,transition:"width .3s"}}/></div>
    <span style={{fontSize:11,fontWeight:600,color:"var(--txt2)",minWidth:28}}>{val||0}%</span>
  </div>
);
export const Inp=({style:s,...p})=>(
  <input {...p} className="inp-base" style={{...s}} onFocus={e=>{e.target.style.borderColor="#2563eb";e.target.style.boxShadow="0 0 0 3px rgba(37,99,235,0.08)";}} onBlur={e=>{e.target.style.borderColor="var(--bdr)";e.target.style.boxShadow="none";}}/>
);
export const Sel=({children,style:s,...p})=>(
  <select {...p} className="inp-base" style={{cursor:"pointer",...s}}>{children}</select>
);
export const TA=({style:s,...p})=>(
  <textarea {...p} className="inp-base" style={{resize:"vertical",...s}} onFocus={e=>{e.target.style.borderColor="#2563eb";e.target.style.boxShadow="0 0 0 3px rgba(37,99,235,0.08)";}} onBlur={e=>{e.target.style.borderColor="var(--bdr)";e.target.style.boxShadow="none";}}/>
);
export const Btn=({children,v="primary",style:s,...p})=>{
  const vs={
    primary:{background:"#2563eb",color:"#fff",border:"none"},
    secondary:{background:"#f1f5f9",color:"#1e293b",border:"1px solid #e2e8f0"},
    danger:{background:"#dc2626",color:"#fff",border:"none"},
    ghost:{background:"transparent",color:"#64748b",border:"1px solid #e2e8f0"},
    success:{background:"#16a34a",color:"#fff",border:"none"},
    amber:{background:"#d97706",color:"#fff",border:"none"},
    purple:{background:"#7c3aed",color:"#fff",border:"none"}
  };
  return <button {...p} style={{padding:"8px 16px",borderRadius:6,fontSize:14,fontWeight:500,cursor:"pointer",transition:"all .15s",display:"inline-flex",alignItems:"center",gap:6,...vs[v],...s}}>{children}</button>;
};
export const Lbl=({children,style:s})=><div style={{fontSize:12,fontWeight:500,color:"var(--txt2)",letterSpacing:"0.04em",textTransform:"uppercase",marginBottom:5,...s}}>{children}</div>;
export const Card=({children,style:s,onClick})=><div onClick={onClick} className="card" style={{...s}}>{children}</div>;
export const Divider=()=><div style={{height:1,background:"var(--bdr)",margin:"16px 0"}}/>;
export const SH=({title,action,color})=>(
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
    <div style={{fontSize:12,color:"var(--txt2)",fontWeight:500,letterSpacing:"0.04em",textTransform:"uppercase",display:"flex",alignItems:"center",gap:8}}><span style={{width:3,height:14,background:color||"#2563eb",borderRadius:2}}/>{title}</div>
    {action}
  </div>
);
export const Stat=({label,value,color,sub})=>(
  <Card style={{padding:"16px 20px"}}>
    <div style={{fontSize:12,color:"var(--txt2)",fontWeight:500,letterSpacing:"0.04em",textTransform:"uppercase",marginBottom:6}}>{label}</div>
    <div style={{fontSize:26,fontWeight:700,color:color||"var(--txt)",lineHeight:1}}>{value}</div>
    {sub&&<div style={{fontSize:12,color:"var(--txt2)",marginTop:4}}>{sub}</div>}
  </Card>
);
export const Modal=({title,children,onClose,wide,maxW})=>(
  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.3)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(6px)"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div style={{width:"100%",maxWidth:maxW||(wide?940:520),maxHeight:"92vh",overflow:"auto",animation:"fadeUp .2s ease",background:"#ffffff",border:"1px solid #e2e8f0",borderRadius:12,boxShadow:"0 20px 60px rgba(0,0,0,0.15)"}}>
      <div style={{padding:"16px 22px",borderBottom:"1px solid #e2e8f0",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:"#ffffff",zIndex:1,borderRadius:"12px 12px 0 0"}}>
        <span style={{fontSize:18,fontWeight:600,color:"#1e293b"}}>{title}</span>
        <button onClick={onClose} style={{background:"none",border:"none",color:"#94a3b8",cursor:"pointer",fontSize:22,padding:"0 6px",lineHeight:1,transition:"color .15s"}} onMouseEnter={e=>e.currentTarget.style.color="#1e293b"} onMouseLeave={e=>e.currentTarget.style.color="#94a3b8"}>×</button>
      </div>
      <div style={{padding:22}}>{children}</div>
    </div>
  </div>
);
export const Toast=({msg,color})=>msg?<div style={{position:"fixed",bottom:24,right:24,background:color||"#16a34a",color:"#fff",padding:"12px 20px",borderRadius:8,fontWeight:600,fontSize:13,zIndex:9999,animation:"fadeUp .2s ease",boxShadow:"0 4px 16px rgba(0,0,0,0.12)"}}>{msg}</div>:null;

export const ThemeToggle=({isDark,toggle})=>(
  <button onClick={toggle} style={{background:"#ffffff",border:"1px solid #e2e8f0",borderRadius:8,padding:"6px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontSize:12,color:"#64748b",transition:"all .2s",boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}>
    <span style={{fontSize:14}}>{isDark?"☀":"🌙"}</span>
    <span style={{fontWeight:500}}>{isDark?"Light":"Dark"}</span>
  </button>
);
