import { useState } from "react";

const EB_LOGO_URL = "https://elecbits.in/wp-content/uploads/2025/06/EB-Logo.svg";

const icons = {
  dashboard: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  projects: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  resources: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  alerts: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  settings: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  logout: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
};

const navItems = [
  { id: "projects", icon: "dashboard", label: "Dashboard" },
  { id: "all-projects", icon: "projects", label: "Projects" },
  { id: "resources", icon: "resources", label: "Resources" },
  { id: "alerts", icon: "alerts", label: "Alerts" },
  { id: "settings", icon: "settings", label: "Settings" },
];

const Tooltip = ({ label }) => (
  <div style={{
    position: "absolute",
    left: 52,
    top: "50%",
    transform: "translateY(-50%)",
    background: "#1e1b4b",
    color: "#ffffff",
    padding: "4px 10px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
    whiteSpace: "nowrap",
    zIndex: 100,
    pointerEvents: "none",
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
  }}>
    {label}
  </div>
);

const Sidebar = ({ activeView, onChangeView, onLogout, user }) => {
  const [hoveredItem, setHoveredItem] = useState(null);
  const [hoveredLogout, setHoveredLogout] = useState(false);

  return (
    <div style={{
      width: 60,
      minWidth: 60,
      height: "100vh",
      background: "linear-gradient(180deg, #6366f1 0%, #8b5cf6 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      paddingTop: 12,
      paddingBottom: 16,
      flexShrink: 0,
      zIndex: 100,
    }}>
      {/* Logo — Elecbits SVG, white/inverted */}
      <div style={{
        width: 36,
        height: 36,
        marginBottom: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        flexShrink: 0,
      }} onClick={() => onChangeView("projects")}>
        <img src={EB_LOGO_URL} alt="Elecbits" style={{height:36,objectFit:"contain",filter:"brightness(0) invert(1)"}} onError={(e)=>{
          e.target.style.display="none";
          e.target.nextSibling.style.display="flex";
        }}/>
        <div style={{display:"none",width:36,height:36,background:"rgba(255,255,255,0.25)",borderRadius:8,alignItems:"center",justifyContent:"center"}}>
          <span style={{ fontSize: 13, fontFamily: "IBM Plex Mono", fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>EB</span>
        </div>
      </div>

      {/* Navigation */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          const isHovered = hoveredItem === item.id;
          return (
            <div
              key={item.id}
              onClick={() => onChangeView(item.id)}
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all .15s",
                background: isActive ? "rgba(255,255,255,0.25)" : "transparent",
                color: "#ffffff",
                opacity: isActive ? 1 : isHovered ? 1 : 0.6,
                position: "relative",
              }}
            >
              {icons[item.icon]}
              {isHovered && <Tooltip label={item.label} />}
            </div>
          );
        })}
      </div>

      {/* User initials + logout at bottom */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.2)",
          border: "2px solid rgba(255,255,255,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 700,
          color: "#ffffff",
          fontFamily: "IBM Plex Mono",
        }}>
          {user?.name ? user.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "?"}
        </div>
        <div
          onClick={onLogout}
          onMouseEnter={() => setHoveredLogout(true)}
          onMouseLeave={() => setHoveredLogout(false)}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all .15s",
            color: "#ffffff",
            opacity: hoveredLogout ? 1 : 0.6,
            position: "relative",
          }}
        >
          {icons.logout}
          {hoveredLogout && <Tooltip label="Sign out" />}
        </div>
      </div>
    </div>
  );
};

export { EB_LOGO_URL };
export default Sidebar;
