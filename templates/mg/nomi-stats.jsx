const Component = ({ item }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const props = item.props || {};
  const fontFamily = props.font;

  const smooth = (f, from) => {
    const v = spring({ frame: f - from, fps: 30, config: { damping: 22, stiffness: 120 } });
    return Math.min(Math.max(v, 0), 1);
  };
  const enter = smooth(frame, 0);
  const exit = interpolate(frame, [durationInFrames - 14, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const count = interpolate(frame, [10, 52], [0, 1], { easing: Easing.out(Easing.cubic), extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const shown = Math.round(Number(props.starTarget) * count);
  const rowIn = smooth(frame, 6);
  const userIn = smooth(frame, 22);

  const rootStyle = { position: "absolute", inset: 0, backgroundColor: "transparent" };
  const cardStyle = {
    position: "absolute", inset: 0, boxSizing: "border-box",
    padding: "30px 44px 26px", display: "flex", flexDirection: "column", justifyContent: "space-between",
    backgroundColor: "rgba(28,28,30,0.74)",
    backdropFilter: "blur(40px) saturate(1.8)",
    border: "1px solid rgba(255,255,255,0.14)",
    boxShadow: "0 30px 70px rgba(0,0,0,0.38)",
    borderRadius: 44,
    opacity: enter * exit,
    transform: "translateY(" + (1 - enter) * 24 + "px) scale(" + (0.97 + 0.03 * enter) + ")",
    fontFamily: fontFamily,
  };
  const headStyle = { display: "flex", alignItems: "baseline", gap: 16 };
  const brandStyle = { fontSize: 40, fontWeight: 700, color: "#FFFFFF" };
  const tagStyle = { fontSize: 28, fontWeight: 500, color: "rgba(255,255,255,0.58)" };
  const dividerStyle = { height: 1, backgroundColor: "rgba(255,255,255,0.14)" };
  const statsStyle = { display: "flex", alignItems: "flex-end", gap: 0 };
  const colStyle = { flex: 1, display: "flex", flexDirection: "column", gap: 2 };
  const bigStyle = { fontSize: 92, fontWeight: 700, color: "#FFFFFF", lineHeight: 1.05, fontVariantNumeric: "tabular-nums" };
  const capStyle = { fontSize: 28, fontWeight: 500, color: "rgba(255,255,255,0.58)" };
  const sepStyle = { width: 1, alignSelf: "stretch", backgroundColor: "rgba(255,255,255,0.14)", margin: "6px 36px" };

  return (
    <div style={rootStyle}>
      <div style={cardStyle}>
        <div style={headStyle}>
          <span style={brandStyle}>{props.brand}</span>
          <span style={tagStyle}>{props.tagline}</span>
        </div>
        <div style={dividerStyle} />
        <div style={statsStyle}>
          <div style={{ ...colStyle, opacity: rowIn, transform: "translateY(" + (1 - rowIn) * 14 + "px)" }}>
            <span style={bigStyle}>{shown}{props.starPlus}</span>
            <span style={capStyle}>{props.starCaption}</span>
          </div>
          <div style={sepStyle} />
          <div style={{ ...colStyle, opacity: userIn, transform: "translateY(" + (1 - userIn) * 14 + "px)" }}>
            <span style={bigStyle}>{props.userBig}</span>
            <span style={capStyle}>{props.userCaption}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
