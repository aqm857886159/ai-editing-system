const Component = ({ item }) => {
  const frame = useCurrentFrame();
  const props = item.props || {};
  const blue = props.blue;
  const fontFamily = props.font;

  const lines = [props.t1, props.t2, props.t3];
  const appearAt = [14, 74, 134];

  const smooth = (f, from) => {
    const v = spring({ frame: f - from, fps: 30, config: { damping: 22, stiffness: 120 } });
    return Math.min(Math.max(v, 0), 1);
  };
  const enter = smooth(frame, 0);

  const rootStyle = { position: "absolute", inset: 0, backgroundColor: "transparent" };
  const cardStyle = {
    position: "absolute", inset: 0, boxSizing: "border-box",
    padding: "28px 40px 12px", display: "flex", flexDirection: "column",
    backgroundColor: "rgba(28,28,30,0.74)",
    backdropFilter: "blur(40px) saturate(1.8)",
    border: "1px solid rgba(255,255,255,0.14)",
    boxShadow: "0 30px 70px rgba(0,0,0,0.38)",
    borderRadius: 44,
    opacity: enter,
    transform: "translateY(" + (1 - enter) * 24 + "px) scale(" + (0.97 + 0.03 * enter) + ")",
    fontFamily: fontFamily,
  };
  const titleStyle = { fontSize: 36, fontWeight: 700, color: "#FFFFFF", marginBottom: 8 };

  const rows = lines.map((text, i) => {
    const k = smooth(frame, appearAt[i]);
    const check = interpolate(frame, [appearAt[i] + 6, appearAt[i] + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
    const rowStyle = {
      display: "flex", alignItems: "center", gap: 22, minHeight: 90,
      borderTop: "1px solid rgba(255,255,255,0.12)",
      opacity: k, transform: "translateY(" + (1 - k) * 14 + "px)",
    };
    const dotStyle = { width: 46, height: 46, borderRadius: 23, flexShrink: 0, backgroundColor: blue, display: "flex", alignItems: "center", justifyContent: "center" };
    const textStyle = { fontSize: 34, fontWeight: 600, color: "#FFFFFF", overflowWrap: "break-word", whiteSpace: "normal" };
    return (
      <div key={i} style={rowStyle}>
        <div style={dotStyle}>
          <svg width="26" height="26" viewBox="0 0 26 26">
            <path d="M5 13.5 L10.5 19 L21 7.5" stroke="#FFFFFF" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray="30" strokeDashoffset={30 * (1 - check)} />
          </svg>
        </div>
        <span style={textStyle}>{text}</span>
      </div>
    );
  });

  return (
    <div style={rootStyle}>
      <div style={cardStyle}>
        <div style={titleStyle}>{props.title}</div>
        {rows}
      </div>
    </div>
  );
};
