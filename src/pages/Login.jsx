import { useState } from "react";
import { Btn, Inp, Lbl, ThemeToggle } from "../components/ui/index.jsx";
import { supabase } from "../lib/supabase.js";
import { EB_LOGO_URL } from "../components/Sidebar.jsx";

const Login=({onLogin,isDark,toggleTheme})=>{
  const [email,setEmail]=useState("");const [pass,setPass]=useState("");const [err,setErr]=useState("");const [loading,setLoading]=useState(false);

  const submit=async()=>{
    if(!email||!pass)return setErr("Enter email and password");
    setLoading(true);setErr("");
    try{
      const{data,error}=await supabase.auth.signInWithPassword({email,password:pass});
      if(error){setErr(error.message||"Invalid email or password.");setLoading(false);return;}
      const{data:profile,error:pe}=await supabase.from("users").select("*,holidays!holidays_user_id_fkey(*)").eq("id",data.user.id).maybeSingle();
      if(pe||!profile){setErr("Profile not found. Contact admin.");setLoading(false);return;}
      onLogin(profile);
    }catch(e){
      console.error("Login error:",e);
      setErr("Login failed. Please try again.");
      setLoading(false);
    }
  };

  return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f8fafc",padding:20,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(circle at 1px 1px, #e2e8f0 1px, transparent 0)",backgroundSize:"32px 32px",opacity:.5}}/>
      <div style={{position:"absolute",top:0,left:0,right:0,height:"50%",background:"linear-gradient(180deg, #0f172a 0%, #1e293b 60%, transparent 100%)"}}/>
      <div style={{position:"absolute",top:16,right:16,zIndex:2}}><ThemeToggle isDark={isDark} toggle={toggleTheme}/></div>
      <div style={{width:"100%",maxWidth:420,position:"relative",zIndex:1,animation:"fadeUp .4s ease"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:12,marginBottom:10}}>
            <img src={EB_LOGO_URL} alt="Elecbits" style={{width:42,height:42,objectFit:"contain"}} onError={(e)=>{
              e.target.style.display="none";
              e.target.nextSibling.style.display="flex";
            }}/>
            <div style={{display:"none",width:42,height:42,background:"#2563eb",borderRadius:10,alignItems:"center",justifyContent:"center"}}>
              <span style={{fontSize:20,fontFamily:"IBM Plex Mono",fontWeight:700,color:"#fff"}}>E</span>
            </div>
          </div>
          <div style={{fontSize:24,fontWeight:800,letterSpacing:"-0.02em",color:"#fff",marginBottom:4}}>Elecbits PMS</div>
          <div style={{fontSize:13,color:"#94a3b8",letterSpacing:"0.02em"}}>Project Management System</div>
        </div>
        <div style={{background:"#ffffff",border:"1px solid #e2e8f0",borderRadius:16,padding:"32px 28px",boxShadow:"0 4px 24px rgba(0,0,0,0.08)"}}>
          <div style={{fontSize:18,fontWeight:700,color:"#1e293b",marginBottom:4}}>Welcome back</div>
          <div style={{fontSize:13,color:"#64748b",marginBottom:24}}>Sign in to your account to continue</div>
          <div style={{marginBottom:16}}>
            <label style={{fontSize:13,fontWeight:600,color:"#374151",marginBottom:6,display:"block"}}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@elecbits.in" onKeyDown={e=>e.key==="Enter"&&submit()}
              style={{width:"100%",padding:"10px 14px",border:"1px solid #e2e8f0",borderRadius:10,fontSize:14,outline:"none",color:"#1e293b",background:"#f8fafc",transition:"all .15s"}}
              onFocus={e=>{e.target.style.borderColor="#2563eb";e.target.style.boxShadow="0 0 0 3px rgba(37,99,235,0.1)";}}
              onBlur={e=>{e.target.style.borderColor="#e2e8f0";e.target.style.boxShadow="none";}}
            />
          </div>
          <div style={{marginBottom:24}}>
            <label style={{fontSize:13,fontWeight:600,color:"#374151",marginBottom:6,display:"block"}}>Password</label>
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="Enter your password" onKeyDown={e=>e.key==="Enter"&&submit()}
              style={{width:"100%",padding:"10px 14px",border:"1px solid #e2e8f0",borderRadius:10,fontSize:14,outline:"none",color:"#1e293b",background:"#f8fafc",transition:"all .15s"}}
              onFocus={e=>{e.target.style.borderColor="#2563eb";e.target.style.boxShadow="0 0 0 3px rgba(37,99,235,0.1)";}}
              onBlur={e=>{e.target.style.borderColor="#e2e8f0";e.target.style.boxShadow="none";}}
            />
          </div>
          {err&&<div style={{color:"#ef4444",fontSize:13,marginBottom:16,padding:"10px 14px",background:"#fef2f2",borderRadius:8,border:"1px solid #fecaca"}}>{err}</div>}
          <button onClick={submit} disabled={loading} style={{
            width:"100%",padding:"11px 20px",background:"#2563eb",color:"#fff",border:"none",borderRadius:10,
            fontSize:14,fontWeight:600,cursor:loading?"wait":"pointer",transition:"all .15s",
            display:"flex",alignItems:"center",justifyContent:"center",gap:8
          }}
            onMouseEnter={e=>{if(!loading)e.currentTarget.style.background="#1d4ed8";}}
            onMouseLeave={e=>{e.currentTarget.style.background="#2563eb";}}
          >
            {loading?<span style={{width:16,height:16,border:"2px solid #ffffff40",borderTop:"2px solid #fff",borderRadius:"50%",animation:"spin .7s linear infinite",display:"inline-block"}}/>:"Sign In"}
            {!loading&&<span style={{fontSize:16}}>→</span>}
          </button>
        </div>
        <div style={{textAlign:"center",marginTop:16,fontSize:12,color:"#94a3b8"}}>Elecbits Private Limited</div>
      </div>
    </div>
  );
};

export default Login;
