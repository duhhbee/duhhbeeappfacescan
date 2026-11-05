export const ScannerChrome = ({ scan }) => {
  const s = scan ?? {};
  const ready = Boolean(s.faceFound && s.position);
  const tip = !s.faceFound ? 'Position your face in the oval'
    : ready ? 'Ready for your front photo' : 'Move your face toward the center';
  const items = [
    { key: 'position', label: 'Position', ok: Boolean(s.position) },
    { key: 'face', label: 'Face', ok: Boolean(s.faceFound) },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        color: '#fff',
      }}
    >
      <div
        style={{
          paddingTop: 'max(12px, env(safe-area-inset-top))',
          paddingLeft: 20,
          paddingRight: 20,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 2.4,
            opacity: 0.55,
            textTransform: 'uppercase',
          }}
        >
          Skin scan
        </div>
        <div style={{ fontSize: 17, fontWeight: 600, marginTop: 4 }}>Look straight</div>
      </div>

      <div
        style={{
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
          paddingLeft: 16,
          paddingRight: 16,
        }}
      >
        <div
          style={{
            background: 'rgba(18, 18, 20, 0.72)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderRadius: 16,
            padding: '14px 16px',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              textAlign: 'center',
              marginBottom: 12,
              color: ready ? '#F5C400' : '#fff',
            }}
          >
            {tip}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            {items.map((item) => (
              <div
                key={item.key}
                style={{
                  flex: 1,
                  maxWidth: 100,
                  textAlign: 'center',
                  padding: '8px 6px',
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 600,
                  background: item.ok ? 'rgba(245, 196, 0, 0.12)' : 'rgba(255,255,255,0.06)',
                  border: item.ok ? '1px solid rgba(245,196,0,0.45)' : '1px solid rgba(255,255,255,0.08)',
                  color: item.ok ? '#F5C400' : 'rgba(255,255,255,0.45)',
                }}
              >
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
