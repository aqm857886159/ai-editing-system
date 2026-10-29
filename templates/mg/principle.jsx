const Component = ({ item }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const props = item.props || {};
  const blue = props.blue;
  const danger = props.danger;
  const fontFamily = props.font;
  const bAt = Number(props.stepBAt);

  const smooth = (f, from) => {
    const v = spring({ frame: f - from, fps: 30, config: { damping: 22, stiffness: 120 } });
    return Math.min(Math.max(v, 0), 1);
  };
  const enter = smooth(frame, 0);
  const exit = interpolate(frame, [durationInFrames - 16, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const aIn = smooth(frame, 12);
  const bIn = smooth(frame, bAt);
  const underline = interpolate(frame, [20, 48], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const chev = interpolate(frame, [bAt - 14, bAt], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const notIn = interpolate(frame, [bAt + 28, bAt + 44], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const strike = interpolate(frame, [bAt + 44, bAt + 64], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });

  const rootStyle = { position: "absolute", inset: 0, backgroundColor: "transparent" };
  const cardStyle = {
    position: "absolute", inset: 0, boxSizing: "border-box",
    padding: "28px 44px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 16,
    backgroundColor: "rgba(28,28,30,0.74)",
    backdropFilter: "blur(40px) saturate(1.8)",
    border: "1px solid rgba(255,255,255,0.14)",
    boxShadow: "0 30px 70px rgba(0,0,0,0.38)",
    borderRadius: 44,
    opacity: enter * exit,
    transform: "translateY(" + (1 - enter) * 24 + "px) scale(" + (0.97 + 0.03 * enter) + ")",
    fontFamily: fontFamily,
  };
  const kickerStyle = { fontSize: 30, fontWeight: 600, color: "rgba(255,255,255,0.58)" };
  const rowStyle = { display: "flex", alignItems: "center", gap: 22 };
  const aWrap = { position: "relative", opacity: aIn, transform: "translateY(" + (1 - aIn) * 16 + "px)" };
  const aText = { fontSize: 88, fontWeight: 700, color: "#FFFFFF", whiteSpace: "nowrap", lineHeight: 1.1 };
  const aLine = { position: "absolute", left: 0, bottom: -4, height: 6, borderRadius: 3, width: (underline * 100) + "%", backgroundColor: blue };
  const bText = { fontSize: 88, fontWeight: 700, color: "rgba(255,255,255,0.88)", whiteSpace: "nowrap", lineHeight: 1.1, opacity: bIn, transform: "translateY(" + (1 - bIn) * 16 + "px)" };
  const chevWrap = { width: 36, height: 56, opacity: chev * 0.5, display: "flex", flexShrink: 0 };
  const notWrap = { position: "relative", alignSelf: "flex-start", opacity: notIn, fontSize: 30, fontWeight: 600, color: "rgba(255,255,255,0.5)" };
  const strikeStyle = { position: "absolute", left: 0, top: "54%", height: 3, width: (strike * 100) + "%", backgroundColor: danger, borderRadius: 2 };

  return (
    <div style={rootStyle}>
      <div style={cardStyle}>
        <div style={kickerStyle}>{props.kicker}</div>
        <div style={rowStyle}>
          <div style={aWrap}>
            <span style={aText}>{props.stepA}</span>
            <div style={aLine} />
          </div>
          <div style={chevWrap}>
            <svg width="36" height="56" viewBox="0 0 36 56">
              <path d="M10 10 L26 28 L10 46" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
          <span style={bText}>{props.stepB}</span>
        </div>
        <div style={notWrap}>
          <span>{props.notLabel}</span>
          <div style={strikeStyle} />
        </div>
      </div>
    </div>
  );
};
