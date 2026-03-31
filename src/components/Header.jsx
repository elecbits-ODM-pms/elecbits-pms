import { Btn, Tag, Av, ThemeToggle } from "./ui/index.jsx";

const Header=({user,onLogout,isDark,toggleTheme,users})=>{
  const roleColor={superadmin:"var(--acc)",pm:"var(--green)",developer:"var(--amber)"}[user.role];
  const roleLabel={superadmin:"Super Admin",pm:"Project Manager",developer:user.dept||"Developer"}[user.role];
  return(
    <div style={{background:"var(--s1)",borderBottom:"1px solid var(--bdr)",padding:"0 22px",display:"flex",alignItems:"center",height:50,flexShrink:0,gap:10}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:24,height:24,background:"var(--acc)",borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:13,fontFamily:"IBM Plex Mono",fontWeight:700,color:"#fff"}}>E</span></div><span style={{fontSize:13,fontWeight:800,letterSpacing:"0.05em",fontFamily:"IBM Plex Mono",color:"var(--txt)"}}>ELECBITS PMS</span><Tag label="v9" color="var(--txt3)"/></div>
      <div style={{flex:1}}/>
      <ThemeToggle isDark={isDark} toggle={toggleTheme}/>
      <div style={{display:"flex",alignItems:"center",gap:10}}><Av uid={user.id} size={26} users={users}/><div><div style={{fontSize:12,fontWeight:700,color:"var(--txt)"}}>{user.name}</div><div style={{fontSize:9,fontFamily:"IBM Plex Mono",color:roleColor,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em"}}>{roleLabel}</div></div><Btn v="secondary" style={{fontSize:10,padding:"4px 10px"}} onClick={onLogout}>Out</Btn></div>
    </div>
  );
};

export default Header;
