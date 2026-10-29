const Component = ({ item }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const props = item.props || {};
  const fontFamily = props.font;

  const labels = [props.l1, props.l2, props.l3, props.l4, props.l5];
  const starts = [0, Number(props.s2), Number(props.s3), Number(props.s4), Number(props.s5)];

  let pos = 0;
  for (let i = 1; i < starts.length; i++) {
    const t = Math.min(Math.max((frame - starts[i]) / 18, 0), 1);
    pos += 1 - Math.pow(1 - t, 3);
  }

  const enter = interpolate(frame, [0, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const exit = interpolate(frame, [durationInFrames - 16, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const vis = enter * exit;

  const pad = 8;
  const segW = (1000 - pad * 2) / 5;

  const rootStyle = { position: "absolute", inset: 0, backgroundColor: "transparent" };
  const trackStyle = {
    position: "absolute", inset: 0,
    backgroundColor: "rgba(28,28,30,0.74)",
    backdropFilter: "blur(40px) saturate(1.8)",
    border: "1px solid rgba(255,255,255,0.14)",
    boxShadow: "0 24px 56px rgba(0,0,0,0.36)",
    borderRadius: 54,
    opacity: vis, transform: "translateY(" + (1 - enter) * 24 + "px)",
    fontFamily: fontFamily,
  };
  const thumbStyle = {
    position: "absolute", top: pad, left: pad + pos * segW, width: segW, height: 108 - pad * 2 - 2,
    borderRadius: 46, backgroundColor: "rgba(255,255,255,0.94)",
    boxShadow: "0 6px 18px rgba(0,0,0,0.28)",
  };
  const items = labels.map((label, i) => {
    const near = Math.max(0, 1 - Math.abs(pos - i));
    const dark = near > 0.5;
    const style = {
      position: "absolute", top: pad, left: pad + i * segW, width: segW, height: 108 - pad * 2 - 2,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 30, fontWeight: dark ? 700 : 600, whiteSpace: "nowrap",
      color: dark ? "#1C1C1E" : "rgba(255,255,255,0.62)",
    };
    return <div key={i} style={style}>{label}</div>;
  });

  return (
    <div style={rootStyle}>
      <div style={trackStyle}>
        <div style={thumbStyle} />
        {items}
      </div>
    </div>
  );
};
