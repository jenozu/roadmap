type IslandSketchProps = {
  variant: number;
  state: "complete" | "current" | "charted";
  isFinal: boolean;
};

const coastlines = [
  "M-85 6Q-99-13-64-18Q-58-43-35-31Q-17-51 4-35Q27-39 37-20Q69-29 83-7Q91 18 60 24Q43 44 18 31Q0 51-26 33Q-57 39-72 22Q-89 23-85 6Z",
  "M-94 4Q-92-25-55-17Q-50-34-31-27Q-15-53 10-34Q37-44 49-17Q83-21 91 2Q91 29 59 27Q32 45 6 35Q-27 51-43 28Q-70 33-94 4Z",
  "M-83 4Q-103-8-69-28Q-39-18-20-43Q4-29 19-40Q43-17 64-23Q84-13 73 5Q89 25 53 31Q27 28 3 43Q-18 30-44 37Q-72 22-83 4Z",
  "M-89-5Q-81-22-59-16Q-47-39-21-33Q-4-51 17-29Q42-33 53-12Q78-11 84 14Q69 35 36 28Q9 45-9 32Q-47 49-65 22Q-92 18-89-5Z"
];

// Deliberately sparse, ink-style icons (ports, ruins and palms) rather than
// mountain emoji or glossy game-world illustrations.
export default function IslandSketch({ variant, state, isFinal }: IslandSketchProps) {
  const coast = coastlines[variant % coastlines.length];
  const fill = state === "complete" ? "#a6ac8b" : state === "current" ? "#c8b787" : "#bdb397";
  return <g aria-hidden="true">
    <path d={coast} transform="translate(0 4) scale(1.13 1.12)"
      fill="none" stroke="#9a9474" strokeWidth="1.3" strokeDasharray="3 5" opacity=".55" />
    <path d={coast} fill={fill} stroke="#615b42" strokeWidth="1.7" />
    <path d="M-64 13 Q-42 0-21 10T20 5T69 8 M-55 25Q-21 15 7 25T54 20"
      fill="none" stroke="#756e53" strokeWidth=".85" opacity=".48" />
    <path d="M-32 30Q-23 17-8 31M22 30Q31 21 43 26" fill="none" stroke="#7d795c" strokeWidth=".8" opacity=".55" />
    {variant % 5 === 0 && <g fill="none" stroke="#4e4c39" strokeWidth="1.8" strokeLinecap="round">
      <path d="M-13 13Q-10-9 2-30 M36 14Q33-8 19-24" />
      <path d="M2-30Q-20-44-28-29M2-30Q-9-51 6-49M2-30Q20-49 29-32M2-30Q17-30 24-18M19-24Q4-40-2-24M19-24Q34-40 43-28M19-24Q33-21 34-11" />
      <path d="M-21 14L5 12M21 14L48 12" opacity=".65" />
    </g>}
    {variant % 5 === 1 && <g fill="none" stroke="#4e4b39" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M-20 19L-14-20H2L9 19ZM-17-21L-13-28H2L6-21ZM-7-28v-8M-5-12V3M-26 18L38 18L45 24L-24 24" />
      <path d="M14 17L24-2H39L48 17M28-1V-15M20-13L28-19L37-13M27 7h7" />
      <path d="M-31 0l-11 16M-33-2l-11-14M-42-16L-22-21" opacity=".65"/>
    </g>}
    {variant % 5 === 2 && <g fill="none" stroke="#4e4b39" strokeWidth="1.7">
      <path d="M-37 21V-9H-24V-23H-11V-10H11V-30H26V-9H41V21ZM-44 22H48M-25 20v-14h16v14M9 20V8h18v12" />
      <path d="M-13-29v-15l17 6-17 4M-20-10h7M14-16h8M34-5h5" />
      <path d="M-45 26Q-32 32-15 26Q2 33 17 26Q29 31 45 25" strokeWidth=".9" />
    </g>}
    {variant % 5 === 3 && <g fill="none" stroke="#504c39" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M-40 24l13-37 17 7 13-26 26 7 13 49 M-29-13l-14-10M4-32l-5-15M-24-1l13 11 18-9M18-19l13 9" />
      <path d="M-20 24v-16Q-12-1-3 8v16M10 23V3Q21-7 32 5v18M-47 25H49" />
      <path d="M-43-23l8 9M-4-46L3-41M31-28l7 7" opacity=".5" />
    </g>}
    {variant % 5 === 4 && <g fill="none" stroke="#4e4b39" strokeWidth="1.6" strokeLinecap="round">
      <path d="M-35 23H37M-28 18l14-34 15 12 19-31 15 53M-14-16l-7-9M20-35l9-10M-10 18l15-8 9 8" />
      <path d="M-21 18Q-12 8-3 18M4 21Q13 11 23 21" strokeWidth="1"/>
      <path d="M-46 5h12M39 10h8" strokeDasharray="2 4" />
    </g>}
    {isFinal && <g stroke="#714b36" strokeWidth="3" strokeLinecap="round">
      <path d="M53-37l22 22m0-22L53-15"/>
      <circle cx="64" cy="-26" r="19" fill="none" strokeWidth="1" strokeDasharray="1 5" />
    </g>}
  </g>;
}
