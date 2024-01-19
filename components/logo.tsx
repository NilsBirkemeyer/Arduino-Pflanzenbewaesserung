import PlantPotLogo from '../assets/plantpot_logo.svg'; // Stelle sicher, dass der Pfad korrekt ist

function Logo() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div style={{ width: 51, height: 51, left: 0, top: 0, position: 'absolute' }}>
        <div style={{ width: 32.85, height: 44.62, left: 9.08, top: 3.19, position: 'absolute', background: '#111918' }}></div>
      </div>
      <div style={{ width: 120, height: 37, left: 61, top: 0, position: 'absolute', color: 'black', fontSize: 32, fontFamily: 'Itim', fontWeight: '400', wordWrap: 'break-word' }}>
        PlantPot
      </div>
      <div style={{ left: 61, top: 34, position: 'absolute', color: 'black', fontSize: 14, fontFamily: 'Itim', fontWeight: '400', wordWrap: 'break-word' }}>
        Let´s grow together
      </div>
      <PlantPotLogo style={{ width: '100%', height: '100%' }} /> {/* SVG-Logo */}
    </div>
  );
}

export default Logo;
