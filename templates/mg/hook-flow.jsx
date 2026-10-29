const Component = ({ item }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const props = item.props || {};
  const blue = props.blue;
  const fontFamily = props.font;

  const steps = [props.step1, props.step2, props.step3, props.step4, props.step5];
  const appearAt = [10, 60, 141, 198, 262];
  const hookAt = 395;

  const smooth = (f, from) => {
    const v = spring({ frame: f - from, fps: 30, config: { damping: 22, stiffness: 120 } });
    return Math.min(Math.max(v, 0), 1);
  };
  const enter = smooth(frame, 0);
  const exit = interpolate(frame, [durationInFrames - 16, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const hookK = smooth(frame, hookAt);
  const rail = interpolate(frame, [hookAt, hookAt + 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });

  const rootStyle = { position: "absolute", inset: 0, backgroundColor: "transparent" };
  const cardStyle = {
    position: "absolute", inset: 0, boxSizing: "border-box",
    padding: "26px 40px 24px", display: "flex", flexDirection: "column", gap: 10,
    backgroundColor: "rgba(28,28,30,0.74)",
    backdropFilter: "blur(40px) saturate(1.8)",
    border: "1px solid rgba(255,255,255,0.14)",
    boxShadow: "0 30px 70px rgba(0,0,0,0.38)",
    borderRadius: 44,
    opacity: enter * exit,
    transform: "translateY(" + (1 - enter) * 24 + "px) scale(" + (0.97 + 0.03 * enter) + ")",
    fontFamily: fontFamily,
  };
  const titleStyle = { fontSize: 30, fontWeight: 600, color: "rgba(255,255,255,0.58)", marginBottom: 4 };
  const listStyle = { position: "relative", display: "flex", flexDirection: "column", gap: 4, paddingLeft: 16 };
  const railStyle = { position: "absolute", left: 0, top: 6, width: 4, borderRadius: 2, height: 262 * rail, backgroundColor: blue };

  const rows = steps.map((text, i) => {
    const k = smooth(frame, appearAt[i]);
    const rowStyle = { display: "flex", alignItems: "center", gap: 18, height: 52, opacity: k, transform: "translateY(" + (1 - k) * 14 + "px)" };
    const numStyle = {
      width: 36, height: 36, borderRadius: 18, flexShrink: 0, boxSizing: "border-box",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 20, fontWeight: 600, color: "rgba(255,255,255,0.7)",
      border: "1.5px solid rgba(255,255,255,0.32)",
    };
    const textStyle = { fontSize: 34, fontWeight: 600, color: "#FFFFFF", whiteSpace: "nowrap" };
    return (
      <div key={i} style={rowStyle}>
        <span style={numStyle}>{i + 1}</span>
        <span style={textStyle}>{text}</span>
      </div>
    );
  });

  const bannerStyle = {
    marginTop: "auto", height: 68, borderRadius: 24, boxSizing: "border-box",
    display: "flex", alignItems: "center", gap: 16, padding: "0 24px",
    backgroundColor: "rgba(10,132,255,0.22)", border: "1px solid rgba(10,132,255,0.55)",
    opacity: hookK, transform: "translateY(" + (1 - hookK) * 12 + "px)",
  };
  const tagStyle = { fontSize: 30, fontWeight: 700, color: "#64B5FF" };
  const hookTextStyle = { fontSize: 31, fontWeight: 600, color: "#FFFFFF" };

  return (
    <div style={rootStyle}>
      <div style={cardStyle}>
        <div style={titleStyle}>{props.title}</div>
        <div style={listStyle}>
          <div style={railStyle} />
          {rows}
        </div>
        <div style={bannerStyle}>
          <span style={tagStyle}>{props.hookLabel}</span>
          <span style={hookTextStyle}>{props.hookText}</span>
        </div>
      </div>
    </div>
  );
};
