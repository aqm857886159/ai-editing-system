const Component = ({ item }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const props = item.props || {};
  const danger = props.danger;
  const fontFamily = props.font;
  const t2 = Number(props.t2);
  const t3 = Number(props.t3);

  const smooth = (f, from) => {
    const v = spring({ frame: f - from, fps: 30, config: { damping: 22, stiffness: 120 } });
    return Math.min(Math.max(v, 0), 1);
  };
  const enter = smooth(frame, 0);
  const exit = interpolate(frame, [durationInFrames - 14, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const k1 = smooth(frame, 8);
  const k2 = smooth(frame, t2);
  const k3 = smooth(frame, t3);
  const c1 = interpolate(frame, [t2 - 12, t2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const c2 = interpolate(frame, [t3 - 12, t3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const shakeAge = frame - t3;
  const shake = shakeAge > 0 && shakeAge < 16 ? Math.sin(shakeAge * 2.4) * 6 * (1 - shakeAge / 16) : 0;

  const rootStyle = { position: "absolute", inset: 0, backgroundColor: "transparent" };
  const cardStyle = {
    position: "absolute", inset: 0, boxSizing: "border-box",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 26,
    backgroundColor: "rgba(28,28,30,0.74)",
    backdropFilter: "blur(40px) saturate(1.8)",
    border: "1px solid rgba(255,255,255,0.14)",
    boxShadow: "0 30px 70px rgba(0,0,0,0.38)",
    borderRadius: 44,
    opacity: enter * exit,
    transform: "translateY(" + (1 - enter) * 24 + "px) scale(" + (0.97 + 0.03 * enter) + ")",
    fontFamily: fontFamily,
  };
  const wordBase = { fontSize: 46, fontWeight: 700, whiteSpace: "nowrap", letterSpacing: 0 };
  const w1 = { ...wordBase, color: "rgba(255,255,255,0.62)", opacity: k1, transform: "translateY(" + (1 - k1) * 14 + "px)" };
  const w2 = { ...wordBase, color: "#FFFFFF", opacity: k2, transform: "translateY(" + (1 - k2) * 14 + "px)" };
  const w3 = { ...wordBase, color: danger, opacity: k3, transform: "translate(" + shake + "px," + (1 - k3) * 14 + "px)" };
  const chevron = (o) => (
    <div style={{ width: 22, height: 30, opacity: o * 0.5, display: "flex", flexShrink: 0 }}>
      <svg width="22" height="30" viewBox="0 0 22 30">
        <path d="M6 5 L16 15 L6 25" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </div>
  );

  return (
    <div style={rootStyle}>
      <div style={cardStyle}>
        <span style={w1}>{props.s1}</span>
        {chevron(c1)}
        <span style={w2}>{props.s2}</span>
        {chevron(c2)}
        <span style={w3}>{props.s3}</span>
      </div>
    </div>
  );
};
