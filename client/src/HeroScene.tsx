function HeroScene() {
  return (
    <div className="heroScene">
      <div className="sceneGlow" />
      <svg className="heroSceneSvg" viewBox="0 0 400 330" xmlns="http://www.w3.org/2000/svg">
        {/* soft ambient circle */}
        <circle className="ambientCircle" cx="200" cy="165" r="150" />

        {/* TV */}
        <ellipse className="tvGlow" cx="200" cy="95" rx="95" ry="55" />
        <rect className="tvScreen" x="130" y="50" width="140" height="90" rx="6" />
        <rect className="line" x="120" y="40" width="160" height="110" rx="10" />
        <path className="line" d="M190 150 L190 175 M210 150 L210 175" />
        <path className="line" d="M160 180 H240" />

        {/* Sofa */}
        <path
          className="sofa"
          d="M55 300 V255 Q55 240 70 240 H330 Q345 240 345 255 V300
             M55 300 H345
             M75 240 V210 Q75 200 90 200 H310 Q325 200 325 210 V240"
        />

        {/* Person 1 */}
        <circle className="line personGlow" cx="150" cy="205" r="16" />
        <path className="line personGlow" d="M124 260 Q124 220 150 220 Q176 220 176 260" />

        {/* Person 2 */}
        <circle className="line personGlow" cx="250" cy="205" r="16" />
        <path className="line personGlow" d="M224 260 Q224 220 250 220 Q276 220 276 260" />

        {/* Floating particles */}
        <circle className="particle p1" cx="90" cy="120" r="3" />
        <circle className="particle p2" cx="320" cy="140" r="2.5" />
        <circle className="particle p3" cx="110" cy="70" r="2" />
        <circle className="particle p4" cx="300" cy="60" r="3" />
        <circle className="particle p5" cx="200" cy="30" r="2.5" />
      </svg>
    </div>
  );
}

export default HeroScene;