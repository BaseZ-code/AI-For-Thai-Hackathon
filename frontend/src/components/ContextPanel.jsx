import CustomerTab from './CustomerTab'
import ChaiTokeCard from './ChaiTokeCard'

export default function ContextPanel({
  activeTab, onTabChange,
  chaiState, mapped, rawResult, isOffline,
  onPush, pushed,
  customerFields,
  pushCount,
}) {
  return (
    <div style={{ display:'flex', flexDirection:'column', background:'var(--zd-panel-bg)', overflow:'hidden' }}>

      {/* Tab header */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--zd-border)', background:'white', flexShrink:0 }}>
        {['customer','apps','knowledge'].map(tab => (
          <div key={tab} onClick={() => onTabChange(tab)} style={{
            flex:1, padding:'10px 0', textAlign:'center',
            fontSize:12, fontWeight:500, cursor:'pointer',
            color: activeTab === tab ? 'var(--zd-blue)' : 'var(--zd-text-muted)',
            borderBottom: activeTab === tab ? '2px solid var(--zd-blue)' : '2px solid transparent',
            transition:'all 0.15s', textTransform:'capitalize',
          }}>
            {tab}
          </div>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex:1, overflowY:'auto' }}>

        {activeTab === 'customer' && (
          <CustomerTab fields={customerFields} pushed={pushed} pushCount={pushCount} />
        )}

        {activeTab === 'apps' && (
          <div style={{ padding:12, display:'flex', flexDirection:'column', gap:10 }}>
            {/* ChaiToke app card */}
            <ChaiTokeCard
              chaiState={chaiState}
              mapped={mapped}
              rawResult={rawResult}
              isOffline={isOffline}
              onPush={onPush}
              pushed={pushed}
            />

            {/* Knowledge app — greyed, collapsed, for realism */}
            <GreyedApp icon="📖" name="Knowledge" />
          </div>
        )}

        {activeTab === 'knowledge' && (
          <div style={{ padding:20, textAlign:'center', color:'#9ca3af', fontSize:12 }}>
            Knowledge panel not available for this ticket type.
          </div>
        )}
      </div>
    </div>
  )
}

function GreyedApp({ icon, name }) {
  return (
    <div style={{
      background:'white', border:'1px solid var(--zd-border)',
      borderRadius:8, overflow:'hidden',
      boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
      opacity: 0.5,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 12px', cursor:'default' }}>
        <div style={{
          width:22, height:22, borderRadius:4, flexShrink:0,
          background:'#ede9fe', color:'#7c3aed',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:12,
        }}>{icon}</div>
        <div style={{ flex:1, fontSize:12, fontWeight:600, color:'#374151' }}>{name}</div>
        <span style={{ fontSize:11, color:'#9ca3af', transform:'rotate(-90deg)', display:'inline-block' }}>▾</span>
      </div>
    </div>
  )
}
