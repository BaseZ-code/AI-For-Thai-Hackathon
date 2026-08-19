export default function IconRail() {
  return (
    <nav style={{
      gridRow: 2, gridColumn: 1,
      background: 'var(--zd-rail-bg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '10px 0', gap: 4,
      borderRight: '1px solid #162032',
    }}>
      {[['🏠','Home'],['🎫','Tickets',true],['🔍','Search'],['📊','Reporting']].map(([icon, title, active]) => (
        <div key={title} title={title} style={{
          width: 36, height: 36,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 8, fontSize: 16, cursor: 'default',
          background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
          color: active ? 'var(--zd-rail-active)' : 'var(--zd-rail-icon)',
          transition: 'background 0.15s',
        }}>{icon}</div>
      ))}
      <div style={{ marginTop: 'auto' }}>
        <div title="Apps" style={{ width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:8,fontSize:16,color:'var(--zd-rail-icon)' }}>⊞</div>
      </div>
    </nav>
  )
}
