export const THEME = {
  bg: '#0f2b2b',
  bgDark: '#080810',
  bgOverlay: 'rgba(5,5,20,0.85)',
  primary: '#ff6b35',
  primaryEnd: '#ffaa44',
  secondary: '#44aaff',
  secondaryEnd: '#2266cc',
  text: '#ffffff',
  textMuted: '#667788',
  textDim: '#445566',
  border: 'rgba(255,255,255,0.08)',
  shadow: 'rgba(0,0,0,0.35)',
  fontHead: "Orbitron, monospace",
  fontBody: "Rajdhani, sans-serif",
  radius: '10px',
  radiusLg: '16px',
};

export const css = document.createElement('style');
css.textContent = `
  @import url('/fonts/fonts.css');

  .ui-font { font-family: ${THEME.fontBody}; }
  .ui-font-head { font-family: ${THEME.fontHead}; }

  .btn {
    padding: 14px 48px;
    font-size: 16px;
    font-weight: 800;
    background: linear-gradient(135deg, ${THEME.primary}, ${THEME.primaryEnd});
    color: ${THEME.text};
    border: none;
    border-radius: ${THEME.radius};
    cursor: pointer;
    letter-spacing: 2px;
    font-family: ${THEME.fontBody};
    box-shadow: 0 4px 20px rgba(255,107,53,0.3);
    transition: all 0.15s ease;
    text-transform: uppercase;
    min-width: 220px;
  }
  .btn:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow: 0 8px 32px rgba(255,107,53,0.5);
  }
  .btn:active { transform: scale(0.97); }

  .btn-secondary {
    background: rgba(255,255,255,0.06);
    color: #aab;
    border: 1px solid ${THEME.border};
    box-shadow: none;
  }
  .btn-secondary:hover {
    background: rgba(255,255,255,0.1);
    color: ${THEME.text};
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  }

  .btn-back {
    margin-top: 14px;
    padding: 10px 28px;
    font-size: 13px;
    background: rgba(255,255,255,0.03);
    color: ${THEME.textMuted};
    border: 1px solid ${THEME.border};
    border-radius: ${THEME.radius};
    cursor: pointer;
    font-family: ${THEME.fontBody};
    transition: all 0.15s;
    letter-spacing: 1px;
  }
  .btn-back:hover { background: rgba(255,255,255,0.06); color: #aab; }

  .card {
    background: ${THEME.bgOverlay};
    border: 1px solid ${THEME.border};
    border-radius: ${THEME.radiusLg};
    backdrop-filter: blur(10px);
  }

  .input {
    padding: 10px 16px;
    font-size: 15px;
    border-radius: 8px;
    border: 1px solid ${THEME.border};
    background: rgba(0,0,0,0.4);
    color: ${THEME.text};
    text-align: center;
    font-family: ${THEME.fontBody};
    outline: none;
    transition: border-color 0.2s;
  }
  .input:focus { border-color: ${THEME.primary}; }

  .slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: rgba(255,255,255,0.1);
    outline: none;
  }
  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: ${THEME.primary};
    cursor: pointer;
    box-shadow: 0 0 10px rgba(255,107,53,0.5);
  }

  .option {
    padding: 10px 16px;
    background: rgba(255,255,255,0.04);
    border: 1px solid ${THEME.border};
    border-radius: 10px;
    color: #aab;
    cursor: pointer;
    font-family: ${THEME.fontBody};
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 1px;
    transition: all 0.15s;
    min-width: 80px;
    text-align: center;
    text-transform: uppercase;
  }
  .option:hover { background: rgba(255,255,255,0.08); color: ${THEME.text}; }
  .option.active {
    background: rgba(255,107,53,0.2);
    border-color: rgba(255,107,53,0.5);
    color: ${THEME.primaryEnd};
    box-shadow: 0 0 15px rgba(255,107,53,0.2);
  }

  .fh-option {
    padding: 8px 16px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    color: #889;
    cursor: pointer;
    font-family: ${THEME.fontBody};
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1px;
    transition: all 0.15s;
    min-width: 56px;
    text-align: center;
  }
  .fh-option:hover { background: rgba(255,255,255,0.08); color: #fff; }
  .fh-option.active { background: rgba(68,170,255,0.18); border-color: rgba(68,170,255,0.5); color: ${THEME.secondary}; }
  .fh-btn {
    padding: 12px 32px;
    font-size: 14px;
    font-weight: 700;
    background: linear-gradient(135deg, ${THEME.primary}, ${THEME.primaryEnd});
    color: #fff;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    letter-spacing: 2px;
    font-family: ${THEME.fontBody};
    transition: all 0.15s ease;
  }
  .fh-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(255,107,53,0.4); }
`;
document.head.appendChild(css);
